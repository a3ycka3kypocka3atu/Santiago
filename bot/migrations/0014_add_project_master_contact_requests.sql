-- Migration: Add project master contact requests
-- Purpose: Let a project page request notify only the masters attached to that project,
-- without showing the request in user or admin cabinets.

CREATE TABLE IF NOT EXISTS public.project_master_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_slug TEXT NOT NULL,
    project_title TEXT NOT NULL,
    page_url TEXT,
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requester_telegram_id BIGINT,
    requester_name TEXT,
    requester_username TEXT,
    comment TEXT,
    target_master_slugs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'archived')),
    notification_error TEXT,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_master_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_master_requests_status_created
    ON public.project_master_requests(status, created_at);

CREATE INDEX IF NOT EXISTS idx_project_master_requests_requested_by
    ON public.project_master_requests(requested_by);

CREATE OR REPLACE FUNCTION public.request_project_master_contact(
    p_user_id UUID,
    p_project_slug TEXT,
    p_project_title TEXT,
    p_page_url TEXT DEFAULT NULL,
    p_comment TEXT DEFAULT NULL,
    p_target_master_slugs TEXT[] DEFAULT ARRAY['andrijpycha']::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_request_id UUID;
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

    IF nullif(trim(p_project_slug), '') IS NULL THEN
        RAISE EXCEPTION 'project_required';
    END IF;

    INSERT INTO public.project_master_requests (
        id,
        project_slug,
        project_title,
        page_url,
        requested_by,
        requester_telegram_id,
        requester_name,
        requester_username,
        comment,
        target_master_slugs,
        status
    )
    VALUES (
        gen_random_uuid(),
        trim(p_project_slug),
        coalesce(nullif(trim(p_project_title), ''), trim(p_project_slug)),
        nullif(trim(p_page_url), ''),
        v_profile.id,
        v_profile.telegram_id,
        coalesce(nullif(v_profile.full_name, ''), v_profile.username, 'Santiago user'),
        v_profile.username,
        nullif(trim(p_comment), ''),
        coalesce(p_target_master_slugs, ARRAY['andrijpycha']::TEXT[]),
        'pending'
    )
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_project_master_contact(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO anon, authenticated;
