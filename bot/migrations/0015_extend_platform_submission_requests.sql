-- Migration: Extend platform-side submissions
-- Date: 2026-05-22
-- Purpose: Support master applications and edit-existing entity requests from the website.

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_kind_check;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_kind_check
  CHECK (kind IN ('profile', 'service', 'project', 'event', 'openmic', 'role_application'));

DROP FUNCTION IF EXISTS public.create_master_submission(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_master_submission(
    p_user_id UUID,
    p_kind TEXT,
    p_title TEXT,
    p_description TEXT,
    p_details TEXT,
    p_mode TEXT DEFAULT 'create_new',
    p_entity_title TEXT DEFAULT NULL,
    p_entity_url TEXT DEFAULT NULL,
    p_entity_key TEXT DEFAULT NULL
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
    v_mode TEXT;
    v_source TEXT;
BEGIN
    IF p_kind NOT IN ('profile', 'service', 'project', 'event', 'role_application') THEN
        RAISE EXCEPTION 'invalid_submission_kind';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    IF p_kind <> 'role_application' AND v_profile.role NOT IN ('instructor', 'admin') THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;

    v_details := nullif(trim(coalesce(p_details, p_description, '')), '');
    IF v_details IS NULL THEN
        RAISE EXCEPTION 'submission_text_required';
    END IF;

    v_mode := coalesce(nullif(trim(p_mode), ''), CASE WHEN p_kind = 'role_application' THEN 'apply_role' ELSE 'create_new' END);
    v_source := CASE
        WHEN p_kind = 'role_application' THEN 'community'
        WHEN v_mode = 'edit_existing' THEN 'platform_entity'
        ELSE 'cabinet'
    END;

    v_title := nullif(trim(coalesce(p_title, '')), '');
    IF v_title IS NULL THEN
        v_title := CASE
            WHEN p_kind = 'profile' THEN 'Редагування профілю майстра'
            WHEN p_kind = 'service' AND v_mode = 'edit_existing' THEN 'Зміна послуги'
            WHEN p_kind = 'service' THEN 'Нова послуга'
            WHEN p_kind = 'project' AND v_mode = 'edit_existing' THEN 'Зміна проєкту'
            WHEN p_kind = 'project' THEN 'Новий проєкт'
            WHEN p_kind = 'event' AND v_mode = 'edit_existing' THEN 'Зміна події'
            WHEN p_kind = 'role_application' THEN 'Заявка стати майстром'
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
        jsonb_strip_nulls(jsonb_build_object(
            'workflow_status', 'pending',
            'source', v_source,
            'mode', v_mode,
            'entity', jsonb_strip_nulls(jsonb_build_object(
                'title', nullif(trim(coalesce(p_entity_title, '')), ''),
                'url', nullif(trim(coalesce(p_entity_url, '')), ''),
                'key', nullif(trim(coalesce(p_entity_key, '')), '')
            )),
            'telegram', jsonb_build_object(
                'id', v_profile.telegram_id,
                'username', v_profile.username,
                'name', coalesce(nullif(v_profile.full_name, ''), v_profile.username, 'Santiago user')
            )
        ))
    )
    RETURNING id INTO v_submission_id;

    RETURN v_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_master_submission(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_admin_submissions(UUID);

CREATE OR REPLACE FUNCTION public.get_admin_submissions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    kind TEXT,
    title TEXT,
    description TEXT,
    details TEXT,
    status TEXT,
    display_status TEXT,
    mode TEXT,
    source TEXT,
    entity_title TEXT,
    entity_url TEXT,
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
        nullif(s.payload->>'mode', '') AS mode,
        nullif(s.payload->>'source', '') AS source,
        nullif(s.payload #>> '{entity,title}', '') AS entity_title,
        nullif(s.payload #>> '{entity,url}', '') AS entity_url,
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

GRANT EXECUTE ON FUNCTION public.get_admin_submissions(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
