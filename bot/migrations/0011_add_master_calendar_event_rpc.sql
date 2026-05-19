-- Migration: Add master calendar event scheduling RPC
-- Date: 2026-05-19
-- Purpose: Let masters schedule attached or quick calendar events from the website.

CREATE OR REPLACE FUNCTION public.create_master_calendar_event(
    p_user_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_type TEXT DEFAULT 'public',
    p_location_type TEXT DEFAULT 'offline_studio',
    p_source_event_id UUID DEFAULT NULL,
    p_mode TEXT DEFAULT 'quick'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_source public.events%ROWTYPE;
    v_event_id UUID;
    v_title TEXT;
    v_description TEXT;
    v_type TEXT;
    v_location_type TEXT;
BEGIN
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    IF v_profile.role NOT IN ('instructor', 'admin') THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;

    IF p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time THEN
        RAISE EXCEPTION 'invalid_event_time';
    END IF;

    IF p_source_event_id IS NOT NULL THEN
        SELECT * INTO v_source
        FROM public.events
        WHERE id = p_source_event_id
          AND status = 'confirmed'
          AND (instructor_id = p_user_id OR v_profile.role = 'admin')
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'source_event_not_found';
        END IF;
    END IF;

    v_title := coalesce(nullif(trim(p_title), ''), nullif(v_source.title, ''), 'Událost');
    v_description := coalesce(nullif(trim(p_description), ''), v_source.description);
    v_type := coalesce(nullif(trim(p_type), ''), nullif(v_source.type, ''), 'public');
    v_location_type := coalesce(nullif(trim(p_location_type), ''), nullif(v_source.location_type, ''), 'offline_studio');

    IF v_type NOT IN ('public', 'club', 'internal') THEN
        RAISE EXCEPTION 'invalid_event_type';
    END IF;

    IF v_location_type NOT IN ('online', 'offline_studio', 'offline_external') THEN
        RAISE EXCEPTION 'invalid_location_type';
    END IF;

    INSERT INTO public.events (
        title,
        description,
        start_time,
        end_time,
        type,
        status,
        instructor_id,
        location_type,
        service_id,
        capacity
    )
    VALUES (
        v_title,
        v_description,
        p_start_time,
        p_end_time,
        v_type,
        'confirmed',
        v_profile.id,
        v_location_type,
        v_source.service_id,
        v_source.capacity
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_master_calendar_event(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, UUID, TEXT) TO anon, authenticated;
