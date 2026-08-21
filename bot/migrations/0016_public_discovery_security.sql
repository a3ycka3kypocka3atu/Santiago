-- Migration: Public discovery request intake and public-MVP containment
-- Date: 2026-08-20
-- Purpose:
--   1. Accept the two public, no-login request types through one narrow RPC.
--   2. Keep request data unreadable to browser roles.
--   3. Disable legacy browser RPCs that treated caller-supplied IDs as identity.
--
-- This migration is intentionally additive for stored data. It does revoke browser
-- access to dormant private-platform functions and tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.public_discovery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type TEXT NOT NULL
        CHECK (request_type IN ('suggest_listing', 'looking_for')),
    listing_type TEXT,
    subject TEXT NOT NULL
        CHECK (char_length(subject) BETWEEN 2 AND 160),
    details TEXT NOT NULL
        CHECK (char_length(details) BETWEEN 10 AND 2500),
    location TEXT
        CHECK (location IS NULL OR char_length(location) <= 160),
    preference TEXT,
    contact TEXT
        CHECK (contact IS NULL OR char_length(contact) BETWEEN 3 AND 240),
    reference_url TEXT
        CHECK (
            reference_url IS NULL
            OR (
                char_length(reference_url) <= 500
                AND reference_url ~* '^https?://'
            )
        ),
    source_page TEXT
        CHECK (source_page IS NULL OR char_length(source_page) <= 500),
    source_channel TEXT NOT NULL DEFAULT 'website'
        CHECK (source_channel IN ('website', 'telegram')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'reviewed', 'archived')),
    notification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (notification_status IN ('pending', 'processing', 'notified', 'failed')),
    notification_attempts INTEGER NOT NULL DEFAULT 0
        CHECK (notification_attempts >= 0),
    notification_claimed_at TIMESTAMPTZ,
    admin_notified_at TIMESTAMPTZ,
    admin_notify_error TEXT
        CHECK (admin_notify_error IS NULL OR char_length(admin_notify_error) <= 500),
    request_fingerprint TEXT
        CHECK (request_fingerprint IS NULL OR char_length(request_fingerprint) = 32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    CONSTRAINT public_discovery_requests_listing_type_check CHECK (
        (request_type = 'suggest_listing' AND listing_type IN ('practitioner', 'service', 'place'))
        OR (request_type = 'looking_for' AND listing_type IS NULL)
    ),
    CONSTRAINT public_discovery_requests_preference_check CHECK (
        (request_type = 'looking_for' AND (preference IS NULL OR preference IN ('online', 'in_person', 'either')))
        OR (request_type = 'suggest_listing' AND preference IS NULL)
    )
);

-- Keep the migration safe if an earlier local draft of this table was applied.
ALTER TABLE public.public_discovery_requests
    ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS notification_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notification_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_notify_error TEXT,
    ADD COLUMN IF NOT EXISTS request_fingerprint TEXT,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days');

CREATE INDEX IF NOT EXISTS idx_public_discovery_requests_review_queue
    ON public.public_discovery_requests(status, created_at);

CREATE INDEX IF NOT EXISTS idx_public_discovery_requests_notification_queue
    ON public.public_discovery_requests(notification_status, notification_claimed_at, created_at)
    WHERE admin_notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_public_discovery_requests_rate_limit
    ON public.public_discovery_requests(request_fingerprint, created_at)
    WHERE request_fingerprint IS NOT NULL;

ALTER TABLE public.public_discovery_requests ENABLE ROW LEVEL SECURITY;

-- There are deliberately no anon/authenticated policies on this table. The only
-- public write route is the validated SECURITY DEFINER function below.
REVOKE ALL PRIVILEGES ON TABLE public.public_discovery_requests
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_discovery_request(
    p_request_type TEXT,
    p_subject TEXT,
    p_details TEXT,
    p_listing_type TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_preference TEXT DEFAULT NULL,
    p_contact TEXT DEFAULT NULL,
    p_reference_url TEXT DEFAULT NULL,
    p_source_page TEXT DEFAULT NULL,
    p_honeypot TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request_type TEXT := lower(trim(coalesce(p_request_type, '')));
    v_subject TEXT := trim(coalesce(p_subject, ''));
    v_details TEXT := trim(coalesce(p_details, ''));
    v_listing_type TEXT := nullif(lower(trim(coalesce(p_listing_type, ''))), '');
    v_location TEXT := nullif(trim(coalesce(p_location, '')), '');
    v_preference TEXT := nullif(lower(trim(coalesce(p_preference, ''))), '');
    v_contact TEXT := nullif(trim(coalesce(p_contact, '')), '');
    v_reference_url TEXT := nullif(trim(coalesce(p_reference_url, '')), '');
    v_source_page TEXT := nullif(trim(coalesce(p_source_page, '')), '');
    v_headers JSONB := '{}'::JSONB;
    v_client_origin TEXT;
    v_request_fingerprint TEXT;
    v_request_id UUID;
BEGIN
    IF nullif(trim(coalesce(p_honeypot, '')), '') IS NOT NULL THEN
        RAISE EXCEPTION 'invalid_request';
    END IF;

    IF v_request_type NOT IN ('suggest_listing', 'looking_for') THEN
        RAISE EXCEPTION 'invalid_request_type';
    END IF;

    IF char_length(v_subject) NOT BETWEEN 2 AND 160 THEN
        RAISE EXCEPTION 'invalid_subject';
    END IF;

    IF char_length(v_details) NOT BETWEEN 10 AND 2500 THEN
        RAISE EXCEPTION 'invalid_details';
    END IF;

    IF v_location IS NOT NULL AND char_length(v_location) > 160 THEN
        RAISE EXCEPTION 'invalid_location';
    END IF;

    IF v_contact IS NULL OR char_length(v_contact) NOT BETWEEN 3 AND 240 THEN
        RAISE EXCEPTION 'invalid_contact';
    END IF;

    IF v_reference_url IS NOT NULL AND (
        char_length(v_reference_url) > 500
        OR v_reference_url !~* '^https?://'
    ) THEN
        RAISE EXCEPTION 'invalid_reference_url';
    END IF;

    IF v_source_page IS NOT NULL AND char_length(v_source_page) > 500 THEN
        RAISE EXCEPTION 'invalid_source_page';
    END IF;

    IF v_request_type = 'suggest_listing' THEN
        IF v_listing_type IS NULL OR v_listing_type NOT IN ('practitioner', 'service', 'place') THEN
            RAISE EXCEPTION 'invalid_listing_type';
        END IF;
        v_preference := NULL;
    ELSE
        v_listing_type := NULL;
        IF v_preference IS NOT NULL AND v_preference NOT IN ('online', 'in_person', 'either') THEN
            RAISE EXCEPTION 'invalid_preference';
        END IF;
    END IF;

    BEGIN
        v_headers := coalesce(
            nullif(current_setting('request.headers', TRUE), '')::JSONB,
            '{}'::JSONB
        );
    EXCEPTION WHEN OTHERS THEN
        v_headers := '{}'::JSONB;
    END;

    v_client_origin := nullif(trim(split_part(coalesce(
        v_headers ->> 'x-forwarded-for',
        v_headers ->> 'cf-connecting-ip',
        v_headers ->> 'x-real-ip',
        ''
    ), ',', 1)), '');

    IF v_client_origin IS NOT NULL THEN
        v_request_fingerprint := md5(
            v_client_origin || ':' || coalesce(v_headers ->> 'user-agent', '')
        );

        IF (
            SELECT count(*)
            FROM public.public_discovery_requests AS request
            WHERE request.request_fingerprint = v_request_fingerprint
              AND request.created_at >= NOW() - INTERVAL '1 hour'
        ) >= 5 THEN
            RAISE EXCEPTION 'rate_limited';
        END IF;
    END IF;

    INSERT INTO public.public_discovery_requests (
        request_type,
        listing_type,
        subject,
        details,
        location,
        preference,
        contact,
        reference_url,
        source_page,
        source_channel,
        request_fingerprint
    ) VALUES (
        v_request_type,
        v_listing_type,
        v_subject,
        v_details,
        v_location,
        v_preference,
        v_contact,
        v_reference_url,
        v_source_page,
        'website',
        v_request_fingerprint
    )
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_discovery_request(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_discovery_request(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_public_discovery_request(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS 'Validated insert-only endpoint for anonymous Lumeya discovery requests.';

CREATE OR REPLACE FUNCTION public.claim_public_discovery_requests(
    p_limit INTEGER DEFAULT 20
)
RETURNS SETOF public.public_discovery_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT request.id
        FROM public.public_discovery_requests AS request
        WHERE request.admin_notified_at IS NULL
          AND request.notification_attempts < 8
          AND (
              request.notification_status IN ('pending', 'failed')
              OR (
                  request.notification_status = 'processing'
                  AND request.notification_claimed_at < NOW() - INTERVAL '15 minutes'
              )
          )
        ORDER BY request.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT greatest(1, least(coalesce(p_limit, 20), 50))
    )
    UPDATE public.public_discovery_requests AS request
    SET notification_status = 'processing',
        notification_claimed_at = NOW(),
        notification_attempts = request.notification_attempts + 1,
        admin_notify_error = NULL
    FROM candidates
    WHERE request.id = candidates.id
    RETURNING request.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_public_discovery_requests(INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_public_discovery_requests(INTEGER)
    TO service_role;

CREATE OR REPLACE FUNCTION public.delete_expired_public_discovery_requests()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_deleted BIGINT;
BEGIN
    DELETE FROM public.public_discovery_requests
    WHERE expires_at <= NOW();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_expired_public_discovery_requests()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_public_discovery_requests()
    TO service_role;

-- Supabase Data API privileges and RLS are separate. Browser roles need only the
-- RPC above; the bot needs the minimum direct table privileges for persistence
-- and notification-state updates.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_discovery_requests
    TO service_role;

-- Tighten the two datasets intentionally readable by the public MVP.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DO $block$
DECLARE
    v_policy RECORD;
BEGIN
    FOR v_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'events'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', v_policy.policyname);
    END LOOP;
END;
$block$;
CREATE POLICY "Anyone can see public confirmed events"
    ON public.events
    FOR SELECT
    TO anon, authenticated
    USING (type = 'public' AND status = 'confirmed');

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DO $block$
DECLARE
    v_policy RECORD;
BEGIN
    FOR v_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'services'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.services', v_policy.policyname);
    END LOOP;
END;
$block$;
CREATE POLICY "Anyone can see public published services"
    ON public.services
    FOR SELECT
    TO anon, authenticated
    USING (type = 'public' AND status = 'published');

REVOKE ALL PRIVILEGES ON TABLE public.events, public.services
    FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.events, public.services TO anon, authenticated;

-- The former policy exposed participant/profile relationships. Public event cards
-- remain available, but participation data is private until proper auth exists.
DROP POLICY IF EXISTS "Anyone can see public event participations"
    ON public.event_participations;

-- Remove direct browser privileges from private platform tables. The service role
-- used by the Telegram bot is not affected by these grants.
DO $block$
DECLARE
    v_table_name TEXT;
BEGIN
    FOREACH v_table_name IN ARRAY ARRAY[
        'profiles',
        'bookings',
        'event_participations',
        'favorites',
        'subscriptions',
        'subscription_notifications',
        'submissions',
        'project_master_requests'
    ]
    LOOP
        IF to_regclass(format('public.%I', v_table_name)) IS NOT NULL THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',
                v_table_name
            );
        END IF;
    END LOOP;
END;
$block$;

-- Prevent future public-schema objects created by the migration role from
-- silently inheriting browser privileges. Every new object must be granted
-- deliberately in its own migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Revoke only functions known to exist in the repository migrations. Each one
-- accepts a caller-provided user/profile ID or returns private operational data.
DO $block$
DECLARE
    v_signature TEXT;
    v_function REGPROCEDURE;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.get_profile_by_telegram_id(bigint)',
        'public.request_event_booking(uuid,uuid)',
        'public.get_profile_booking_status(uuid,uuid[])',
        'public.upsert_event_participation(uuid,uuid,boolean)',
        'public.get_event_public_stats(uuid[])',
        'public.get_profile_submissions(uuid)',
        'public.get_mentor_activity_summary(uuid)',
        'public.get_admin_platform_overview(uuid)',
        'public.upsert_favorite(uuid,text,text,text,text,text,jsonb)',
        'public.delete_favorite(uuid,text,text)',
        'public.get_profile_favorites(uuid)',
        'public.upsert_event_reminder_subscription(uuid,text,text,timestamptz,timestamptz,text,jsonb)',
        'public.pause_event_reminder_subscription(uuid,text)',
        'public.get_profile_subscriptions(uuid)',
        'public.request_service_booking(uuid,text,text,timestamptz,text)',
        'public.get_profile_service_booking_requests(uuid)',
        'public.create_master_submission(uuid,text,text,text,text,text)',
        'public.create_master_submission(uuid,text,text,text,text,text,text,text,text)',
        'public.get_admin_submissions(uuid)',
        'public.update_admin_submission_status(uuid,uuid,text,text,text)',
        'public.create_master_calendar_event(uuid,text,text,timestamptz,timestamptz,text,text,uuid,text)',
        'public.request_openmic_submission(uuid,text)',
        'public.request_project_master_contact(uuid,text,text,text,text,text[])'
    ]
    LOOP
        v_function := to_regprocedure(v_signature);
        IF v_function IS NOT NULL THEN
            EXECUTE format(
                'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
                v_function
            );
        END IF;
    END LOOP;
END;
$block$;

NOTIFY pgrst, 'reload schema';

COMMIT;
