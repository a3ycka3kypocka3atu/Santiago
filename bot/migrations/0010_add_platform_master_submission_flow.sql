-- Migration: Add platform-side master submissions
-- Date: 2026-05-18
-- Purpose: Let masters create profile/service/project/event requests from cabinet
-- and let admins review them on the platform.

CREATE OR REPLACE FUNCTION public.create_master_submission(
    p_user_id UUID,
    p_kind TEXT,
    p_title TEXT,
    p_description TEXT,
    p_details TEXT,
    p_mode TEXT DEFAULT 'create_new'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_submission_id UUID;
    v_title TEXT;
    v_details TEXT;
BEGIN
    IF p_kind NOT IN ('profile', 'service', 'project', 'event') THEN
        RAISE EXCEPTION 'invalid_submission_kind';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    IF v_profile.role NOT IN ('instructor', 'admin') THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;

    v_details := nullif(trim(coalesce(p_details, p_description, '')), '');
    IF v_details IS NULL THEN
        RAISE EXCEPTION 'submission_text_required';
    END IF;

    v_title := nullif(trim(coalesce(p_title, '')), '');
    IF v_title IS NULL THEN
        v_title := CASE
            WHEN p_kind = 'profile' THEN 'Редагування профілю майстра'
            WHEN p_kind = 'service' THEN 'Нова послуга'
            WHEN p_kind = 'project' THEN 'Новий проєкт'
            ELSE 'Нова подія'
        END;
    END IF;

    INSERT INTO public.submissions (
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
        p_kind,
        v_title,
        nullif(trim(coalesce(p_description, v_details)), ''),
        v_details,
        v_profile.id,
        v_profile.telegram_id,
        'pending',
        jsonb_build_object(
            'workflow_status', 'pending',
            'source', 'cabinet',
            'mode', coalesce(nullif(trim(p_mode), ''), 'create_new'),
            'telegram', jsonb_build_object(
                'id', v_profile.telegram_id,
                'username', v_profile.username,
                'name', coalesce(nullif(v_profile.full_name, ''), v_profile.username, 'Santiago master')
            )
        )
    )
    RETURNING id INTO v_submission_id;

    RETURN v_submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_submissions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    kind TEXT,
    title TEXT,
    description TEXT,
    details TEXT,
    status TEXT,
    display_status TEXT,
    author_name TEXT,
    author_username TEXT,
    telegram_id BIGINT,
    admin_message TEXT,
    published_url TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE profiles.id = p_user_id;

    IF v_role <> 'admin' THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.kind,
        s.title,
        s.description,
        s.details,
        s.status,
        coalesce(nullif(s.payload->>'workflow_status', ''), s.status) AS display_status,
        coalesce(nullif(p.full_name, ''), s.payload #>> '{telegram,name}') AS author_name,
        coalesce(nullif(p.username, ''), s.payload #>> '{telegram,username}') AS author_username,
        coalesce(s.telegram_id, p.telegram_id) AS telegram_id,
        nullif(s.payload->>'admin_message', '') AS admin_message,
        nullif(s.payload->>'published_url', '') AS published_url,
        s.created_at,
        s.updated_at
    FROM public.submissions s
    LEFT JOIN public.profiles p ON p.id = s.submitted_by
    WHERE coalesce(nullif(s.payload->>'workflow_status', ''), s.status) IN ('pending', 'needs_info', 'approved')
    ORDER BY s.created_at DESC
    LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_submission_status(
    p_user_id UUID,
    p_submission_id UUID,
    p_workflow_status TEXT,
    p_admin_message TEXT DEFAULT NULL,
    p_published_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_db_status TEXT;
    v_payload_patch JSONB;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE profiles.id = p_user_id;

    IF v_role <> 'admin' THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;

    IF p_workflow_status NOT IN ('pending', 'needs_info', 'approved', 'rejected', 'published') THEN
        RAISE EXCEPTION 'invalid_workflow_status';
    END IF;

    v_db_status := CASE
        WHEN p_workflow_status = 'rejected' THEN 'rejected'
        WHEN p_workflow_status IN ('approved', 'published') THEN 'approved'
        ELSE 'pending'
    END;

    v_payload_patch := jsonb_strip_nulls(jsonb_build_object(
        'workflow_status', p_workflow_status,
        'admin_message', nullif(trim(coalesce(p_admin_message, '')), ''),
        'published_url', nullif(trim(coalesce(p_published_url, '')), ''),
        'reviewed_by', p_user_id,
        'reviewed_at', now()
    ));

    UPDATE public.submissions
    SET
        status = v_db_status,
        payload = coalesce(payload, '{}'::jsonb) || v_payload_patch,
        updated_at = now()
    WHERE id = p_submission_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'submission_not_found';
    END IF;

    RETURN p_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_master_submission(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_submissions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_submission_status(UUID, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
