-- Migration: Add audience subscriptions and event reminder notifications
-- Date: 2026-05-13
-- Purpose: Keep favorites as a saved library, then schedule Telegram reminders
-- and future audience notifications through a reusable subscription layer.

CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_key TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, item_type, item_key)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_item_type_check;

ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_item_type_check
  CHECK (item_type IN ('event', 'service', 'mentor', 'project', 'content'));

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('event', 'service', 'mentor', 'project', 'content')),
    target_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    source TEXT NOT NULL DEFAULT 'favorite_auto' CHECK (source IN ('favorite_auto', 'explicit_subscribe', 'booking', 'admin')),
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, target_type, target_key, source)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subscription_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('event', 'service', 'mentor', 'project', 'content')),
    target_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    send_at TIMESTAMPTZ NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_target ON public.subscriptions(user_id, target_type, target_key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_target ON public.subscriptions(target_type, target_key);
CREATE INDEX IF NOT EXISTS idx_subscription_notifications_due ON public.subscription_notifications(status, send_at);
CREATE INDEX IF NOT EXISTS idx_subscription_notifications_user ON public.subscription_notifications(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_notifications_pending_kind
    ON public.subscription_notifications(subscription_id, kind)
    WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.upsert_favorite(
    p_user_id UUID,
    p_item_type TEXT,
    p_item_key TEXT,
    p_title TEXT,
    p_subtitle TEXT DEFAULT NULL,
    p_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.favorites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_favorite public.favorites%ROWTYPE;
BEGIN
    IF p_item_type NOT IN ('event', 'service', 'mentor', 'project', 'content') THEN
        RAISE EXCEPTION 'invalid_favorite_type';
    END IF;

    IF p_user_id IS NULL OR p_item_key IS NULL OR length(trim(p_item_key)) = 0 THEN
        RAISE EXCEPTION 'invalid_favorite_payload';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    INSERT INTO public.favorites (
        user_id,
        item_type,
        item_key,
        title,
        subtitle,
        url,
        metadata,
        updated_at
    )
    VALUES (
        p_user_id,
        p_item_type,
        p_item_key,
        coalesce(nullif(trim(p_title), ''), p_item_key),
        nullif(trim(coalesce(p_subtitle, '')), ''),
        nullif(trim(coalesce(p_url, '')), ''),
        coalesce(p_metadata, '{}'::jsonb),
        NOW()
    )
    ON CONFLICT (user_id, item_type, item_key)
    DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        url = EXCLUDED.url,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING * INTO v_favorite;

    RETURN v_favorite;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_event_reminder_subscription(
    p_user_id UUID,
    p_target_key TEXT,
    p_title TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ DEFAULT NULL,
    p_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription public.subscriptions%ROWTYPE;
    v_offset INTEGER;
    v_send_at TIMESTAMPTZ;
    v_kind TEXT;
    v_title TEXT;
    v_url TEXT;
    v_metadata JSONB;
    v_count INTEGER := 0;
BEGIN
    IF p_user_id IS NULL OR p_target_key IS NULL OR length(trim(p_target_key)) = 0 THEN
        RAISE EXCEPTION 'invalid_subscription_payload';
    END IF;

    IF p_start_time IS NULL THEN
        RAISE EXCEPTION 'event_start_time_required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    v_title := coalesce(nullif(trim(coalesce(p_title, '')), ''), p_target_key);
    v_url := nullif(trim(coalesce(p_url, '')), '');
    v_metadata := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'title', v_title,
        'start_time', p_start_time,
        'end_time', p_end_time,
        'url', v_url
    );

    INSERT INTO public.subscriptions (
        user_id,
        target_type,
        target_key,
        status,
        source,
        preferences,
        metadata,
        updated_at
    )
    VALUES (
        p_user_id,
        'event',
        trim(p_target_key),
        'active',
        'favorite_auto',
        jsonb_build_object('event_reminders', true, 'offset_minutes', jsonb_build_array(1440, 180)),
        v_metadata,
        NOW()
    )
    ON CONFLICT (user_id, target_type, target_key, source)
    DO UPDATE SET
        status = 'active',
        preferences = jsonb_build_object('event_reminders', true, 'offset_minutes', jsonb_build_array(1440, 180)),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING * INTO v_subscription;

    UPDATE public.subscription_notifications
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE subscription_id = v_subscription.id
      AND status = 'pending'
      AND kind IN ('event_reminder_24h', 'event_reminder_3h');

    FOREACH v_offset IN ARRAY ARRAY[1440, 180]
    LOOP
        v_send_at := p_start_time - (v_offset || ' minutes')::interval;
        v_kind := CASE
            WHEN v_offset = 1440 THEN 'event_reminder_24h'
            ELSE 'event_reminder_3h'
        END;

        IF p_start_time > NOW() AND v_send_at > NOW() THEN
            INSERT INTO public.subscription_notifications (
                subscription_id,
                user_id,
                target_type,
                target_key,
                kind,
                send_at,
                payload,
                status,
                updated_at
            )
            VALUES (
                v_subscription.id,
                p_user_id,
                'event',
                trim(p_target_key),
                v_kind,
                v_send_at,
                jsonb_build_object(
                    'title', v_title,
                    'start_time', p_start_time,
                    'end_time', p_end_time,
                    'url', v_url,
                    'offset_minutes', v_offset,
                    'metadata', v_metadata
                ),
                'pending',
                NOW()
            )
            ON CONFLICT (subscription_id, kind) WHERE status = 'pending'
            DO UPDATE SET
                send_at = EXCLUDED.send_at,
                payload = EXCLUDED.payload,
                updated_at = NOW();

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'subscription_id', v_subscription.id,
        'status', v_subscription.status,
        'scheduled_count', v_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_event_reminder_subscription(
    p_user_id UUID,
    p_target_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription_id UUID;
BEGIN
    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND target_type = 'event'
      AND target_key = p_target_key
      AND source = 'favorite_auto'
    LIMIT 1;

    IF v_subscription_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.subscriptions
    SET status = 'paused',
        preferences = jsonb_set(
            coalesce(preferences, '{}'::jsonb),
            '{event_reminders}',
            'false'::jsonb,
            true
        ),
        updated_at = NOW()
    WHERE id = v_subscription_id;

    UPDATE public.subscription_notifications
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE subscription_id = v_subscription_id
      AND status = 'pending';

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_subscriptions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    target_type TEXT,
    target_key TEXT,
    status TEXT,
    source TEXT,
    preferences JSONB,
    metadata JSONB,
    pending_count BIGINT,
    next_send_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        s.id,
        s.target_type,
        s.target_key,
        s.status,
        s.source,
        s.preferences,
        s.metadata,
        count(n.id) FILTER (WHERE n.status = 'pending') AS pending_count,
        min(n.send_at) FILTER (WHERE n.status = 'pending') AS next_send_at,
        s.created_at,
        s.updated_at
    FROM public.subscriptions s
    LEFT JOIN public.subscription_notifications n ON n.subscription_id = s.id
    WHERE s.user_id = p_user_id
    GROUP BY s.id
    ORDER BY s.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_event_reminder_subscription(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_event_reminder_subscription(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_subscriptions(UUID) TO anon, authenticated;
