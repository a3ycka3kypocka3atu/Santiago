-- Migration: Add public event participation and scoped operational views
-- Date: 2026-05-13
-- Purpose: Split private booking state from public "I will come" participation,
-- expose mentor-owned activity, and keep admin/master web visibility to counts.

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS capacity INTEGER CHECK (capacity IS NULL OR capacity > 0);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'bookings'
          AND constraint_name = 'bookings_status_check'
    ) THEN
        ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
    END IF;

    ALTER TABLE public.bookings
        ADD CONSTRAINT bookings_status_check
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected'));
END $$;

CREATE TABLE IF NOT EXISTS public.event_participations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'attending' CHECK (status IN ('attending', 'cancelled')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility = 'public'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_participations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_event_participations_event_status
    ON public.event_participations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_participations_user
    ON public.event_participations(user_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND policyname = 'Staff can see all bookings'
    ) THEN
        DROP POLICY "Staff can see all bookings" ON public.bookings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND policyname = 'Instructors can see own event bookings'
    ) THEN
        CREATE POLICY "Instructors can see own event bookings"
        ON public.bookings FOR SELECT
        USING (
            EXISTS (
                SELECT 1
                FROM public.events e
                LEFT JOIN public.services s ON s.id = e.service_id
                WHERE e.id = bookings.event_id
                  AND (e.instructor_id = auth.uid() OR s.instructor_id = auth.uid())
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'event_participations'
          AND policyname = 'Anyone can see public event participations'
    ) THEN
        CREATE POLICY "Anyone can see public event participations"
        ON public.event_participations FOR SELECT
        USING (visibility = 'public' AND status = 'attending');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'event_participations'
          AND policyname = 'Users can manage own event participation'
    ) THEN
        CREATE POLICY "Users can manage own event participation"
        ON public.event_participations FOR ALL
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.request_event_booking(p_event_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event public.events%ROWTYPE;
    v_user_role TEXT;
    v_booking_id UUID;
BEGIN
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND status = 'confirmed';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'event_not_available';
    END IF;

    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    IF v_event.type = 'club' AND v_user_role NOT IN ('resident', 'instructor', 'admin') THEN
        RAISE EXCEPTION 'not_allowed_for_event';
    END IF;

    IF v_event.type = 'internal' AND v_user_role NOT IN ('instructor', 'admin') THEN
        RAISE EXCEPTION 'not_allowed_for_event';
    END IF;

    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE event_id = p_event_id
      AND user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_booking_id IS NOT NULL THEN
        UPDATE public.bookings
        SET status = 'pending'
        WHERE id = v_booking_id
          AND status IN ('cancelled', 'rejected');

        RETURN v_booking_id;
    END IF;

    INSERT INTO public.bookings (event_id, user_id, status)
    VALUES (p_event_id, p_user_id, 'pending')
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_booking_status(
    p_user_id UUID,
    p_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
    event_id UUID,
    status TEXT,
    title TEXT,
    start_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT b.event_id, b.status, e.title, e.start_time, b.created_at
    FROM public.bookings b
    LEFT JOIN public.events e ON e.id = b.event_id
    WHERE b.user_id = p_user_id
      AND (p_event_ids IS NULL OR b.event_id = ANY(p_event_ids))
    ORDER BY b.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.upsert_event_participation(
    p_event_id UUID,
    p_user_id UUID,
    p_attending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event public.events%ROWTYPE;
    v_user_role TEXT;
    v_status TEXT := CASE WHEN p_attending THEN 'attending' ELSE 'cancelled' END;
    v_count BIGINT;
BEGIN
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND status = 'confirmed';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'event_not_available';
    END IF;

    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    IF v_event.type = 'club' AND v_user_role NOT IN ('resident', 'instructor', 'admin') THEN
        RAISE EXCEPTION 'not_allowed_for_event';
    END IF;

    IF v_event.type = 'internal' AND v_user_role NOT IN ('instructor', 'admin') THEN
        RAISE EXCEPTION 'not_allowed_for_event';
    END IF;

    INSERT INTO public.event_participations (
        event_id,
        user_id,
        status,
        visibility,
        updated_at
    )
    VALUES (
        p_event_id,
        p_user_id,
        v_status,
        'public',
        NOW()
    )
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW();

    SELECT count(*) INTO v_count
    FROM public.event_participations
    WHERE event_id = p_event_id
      AND status = 'attending';

    RETURN jsonb_build_object(
        'event_id', p_event_id,
        'is_attending', p_attending,
        'participant_count', v_count,
        'capacity', v_event.capacity
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_public_stats(p_event_ids UUID[])
RETURNS TABLE (
    event_id UUID,
    capacity INTEGER,
    participant_count BIGINT,
    participants JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        e.id AS event_id,
        e.capacity,
        count(ep.id) FILTER (WHERE ep.status = 'attending') AS participant_count,
        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'profile_id', p.id,
                    'name', coalesce(nullif(p.full_name, ''), p.username, 'Santiago user'),
                    'username', p.username
                )
                ORDER BY ep.created_at
            ) FILTER (WHERE ep.status = 'attending'),
            '[]'::jsonb
        ) AS participants
    FROM public.events e
    LEFT JOIN public.event_participations ep ON ep.event_id = e.id
    LEFT JOIN public.profiles p ON p.id = ep.user_id
    WHERE e.id = ANY(p_event_ids)
    GROUP BY e.id, e.capacity;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_submissions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    kind TEXT,
    title TEXT,
    description TEXT,
    details TEXT,
    status TEXT,
    display_status TEXT,
    admin_message TEXT,
    published_url TEXT,
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
        s.kind,
        s.title,
        s.description,
        s.details,
        s.status,
        coalesce(nullif(s.payload->>'workflow_status', ''), s.status) AS display_status,
        nullif(s.payload->>'admin_message', '') AS admin_message,
        nullif(s.payload->>'published_url', '') AS published_url,
        s.created_at,
        s.updated_at
    FROM public.submissions s
    WHERE s.submitted_by = p_user_id
    ORDER BY s.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_mentor_activity_summary(p_user_id UUID)
RETURNS TABLE (
    item_type TEXT,
    item_id TEXT,
    title TEXT,
    status TEXT,
    start_time TIMESTAMPTZ,
    favorite_count BIGINT,
    booking_count BIGINT,
    confirmed_booking_count BIGINT,
    participant_count BIGINT,
    capacity INTEGER,
    url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH owned_events AS (
        SELECT e.*
        FROM public.events e
        LEFT JOIN public.services s ON s.id = e.service_id
        WHERE e.instructor_id = p_user_id
           OR s.instructor_id = p_user_id
    ),
    event_rows AS (
        SELECT
            'event'::text AS item_type,
            e.id::text AS item_id,
            e.title,
            e.status,
            e.start_time,
            count(DISTINCT f.id) AS favorite_count,
            count(DISTINCT b.id) AS booking_count,
            count(DISTINCT b.id) FILTER (WHERE b.status = 'confirmed') AS confirmed_booking_count,
            count(DISTINCT ep.id) FILTER (WHERE ep.status = 'attending') AS participant_count,
            e.capacity,
            'calendar.html'::text AS url
        FROM owned_events e
        LEFT JOIN public.favorites f ON f.item_type = 'event' AND f.item_key = e.id::text
        LEFT JOIN public.bookings b ON b.event_id = e.id
        LEFT JOIN public.event_participations ep ON ep.event_id = e.id
        GROUP BY e.id, e.title, e.status, e.start_time, e.capacity
    ),
    service_rows AS (
        SELECT
            'service'::text AS item_type,
            s.slug AS item_id,
            s.title,
            s.status,
            NULL::timestamptz AS start_time,
            count(DISTINCT f.id) AS favorite_count,
            0::bigint AS booking_count,
            0::bigint AS confirmed_booking_count,
            0::bigint AS participant_count,
            NULL::integer AS capacity,
            s.detail_page AS url
        FROM public.services s
        LEFT JOIN public.favorites f ON f.item_type = 'service' AND f.item_key = s.slug
        WHERE s.instructor_id = p_user_id
        GROUP BY s.slug, s.title, s.status, s.detail_page
    )
    SELECT *
    FROM event_rows
    UNION ALL
    SELECT *
    FROM service_rows
    ORDER BY start_time DESC NULLS LAST, title;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_platform_overview(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_result JSONB;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_role <> 'admin' THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;

    SELECT jsonb_build_object(
        'profiles_by_role', (
            SELECT coalesce(jsonb_object_agg(role, count), '{}'::jsonb)
            FROM (
                SELECT role, count(*) AS count
                FROM public.profiles
                GROUP BY role
            ) grouped
        ),
        'submissions_by_status', (
            SELECT coalesce(jsonb_object_agg(display_status, count), '{}'::jsonb)
            FROM (
                SELECT coalesce(nullif(payload->>'workflow_status', ''), status) AS display_status,
                       count(*) AS count
                FROM public.submissions
                GROUP BY coalesce(nullif(payload->>'workflow_status', ''), status)
            ) grouped
        ),
        'events', (
            SELECT jsonb_build_object(
                'total', count(*),
                'confirmed', count(*) FILTER (WHERE status = 'confirmed'),
                'pending', count(*) FILTER (WHERE status = 'pending'),
                'cancelled', count(*) FILTER (WHERE status = 'cancelled')
            )
            FROM public.events
        ),
        'services', (
            SELECT jsonb_build_object(
                'total', count(*),
                'published', count(*) FILTER (WHERE status = 'published'),
                'draft', count(*) FILTER (WHERE status = 'draft')
            )
            FROM public.services
        ),
        'bookings_by_status', (
            SELECT coalesce(jsonb_object_agg(status, count), '{}'::jsonb)
            FROM (
                SELECT status, count(*) AS count
                FROM public.bookings
                GROUP BY status
            ) grouped
        ),
        'public_participations', (
            SELECT count(*)
            FROM public.event_participations
            WHERE status = 'attending'
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_event_booking(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_booking_status(UUID, UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_event_participation(UUID, UUID, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_public_stats(UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_submissions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mentor_activity_summary(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_overview(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
