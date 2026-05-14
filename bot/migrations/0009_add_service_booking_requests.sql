-- Migration: Add service booking requests
-- Purpose: Let logged-in visitors request a preferred day/time for an evergreen service.

CREATE OR REPLACE FUNCTION public.request_service_booking(
    p_user_id UUID,
    p_service_slug TEXT,
    p_service_title TEXT,
    p_requested_at TIMESTAMPTZ,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_service public.services%ROWTYPE;
    v_submission_id UUID;
    v_service_title TEXT;
    v_details TEXT;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'profile_required';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    IF nullif(trim(p_service_slug), '') IS NULL THEN
        RAISE EXCEPTION 'service_required';
    END IF;

    IF p_requested_at IS NULL THEN
        RAISE EXCEPTION 'requested_time_required';
    END IF;

    IF p_requested_at <= now() THEN
        RAISE EXCEPTION 'requested_time_in_past';
    END IF;

    SELECT * INTO v_service
    FROM public.services
    WHERE slug = p_service_slug
      AND status = 'published'
    LIMIT 1;

    v_service_title := coalesce(
        nullif(v_service.title, ''),
        nullif(trim(p_service_title), ''),
        p_service_slug
    );

    v_details := concat_ws(
        E'\n',
        'Бажаний час: ' || to_char(p_requested_at AT TIME ZONE 'Europe/Prague', 'YYYY-MM-DD HH24:MI') || ' Europe/Prague',
        'Послуга: ' || v_service_title,
        CASE WHEN nullif(trim(p_note), '') IS NOT NULL THEN 'Коментар: ' || trim(p_note) ELSE NULL END
    );

    INSERT INTO public.submissions (
        id,
        kind,
        title,
        description,
        details,
        submitted_by,
        telegram_id,
        status,
        payload
    )
    VALUES (
        gen_random_uuid(),
        'service',
        'Бронювання: ' || v_service_title,
        'Запит на бронювання часу для послуги.',
        v_details,
        v_profile.id,
        v_profile.telegram_id,
        'pending',
        jsonb_build_object(
            'purpose', 'service_booking',
            'workflow_status', 'pending',
            'service_slug', p_service_slug,
            'service_title', v_service_title,
            'service_id', v_service.id,
            'requested_at', p_requested_at,
            'note', nullif(trim(p_note), ''),
            'telegram', jsonb_build_object(
                'id', v_profile.telegram_id,
                'username', v_profile.username,
                'name', coalesce(nullif(v_profile.full_name, ''), v_profile.username, 'Santiago user')
            )
        )
    )
    RETURNING id INTO v_submission_id;

    RETURN v_submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_service_booking_requests(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    service_slug TEXT,
    service_title TEXT,
    requested_at TIMESTAMPTZ,
    status TEXT,
    display_status TEXT,
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
        s.payload->>'service_slug' AS service_slug,
        coalesce(nullif(s.payload->>'service_title', ''), s.title) AS service_title,
        nullif(s.payload->>'requested_at', '')::timestamptz AS requested_at,
        s.status,
        coalesce(nullif(s.payload->>'workflow_status', ''), s.status) AS display_status,
        s.created_at,
        s.updated_at
    FROM public.submissions s
    WHERE s.submitted_by = p_user_id
      AND s.kind = 'service'
      AND s.payload->>'purpose' = 'service_booking'
    ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.request_service_booking(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_service_booking_requests(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
