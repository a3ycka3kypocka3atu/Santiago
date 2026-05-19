-- Migration: Add website Open Mic submissions
-- Date: 2026-05-19
-- Purpose: Let logged-in visitors submit Open Mic / Santiago Talks requests
-- from the public page and show them in the admin cabinet.

ALTER TABLE public.submissions
DROP CONSTRAINT IF EXISTS submissions_kind_check;

ALTER TABLE public.submissions
ADD CONSTRAINT submissions_kind_check
CHECK (kind IN ('profile', 'service', 'project', 'event', 'openmic'));

CREATE OR REPLACE FUNCTION public.request_openmic_submission(
    p_user_id UUID,
    p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_submission_id UUID;
    v_message TEXT;
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

    v_message := nullif(trim(coalesce(p_message, '')), '');
    IF v_message IS NULL THEN
        RAISE EXCEPTION 'submission_text_required';
    END IF;

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
        'openmic',
        'Open Mic / Santiago Talks',
        'Заявка на виступ на Open Mic / Santiago Talks.',
        v_message,
        v_profile.id,
        v_profile.telegram_id,
        'pending',
        jsonb_build_object(
            'purpose', 'openmic_submission',
            'source', 'openmic_page',
            'workflow_status', 'pending',
            'telegram', jsonb_build_object(
                'id', v_profile.telegram_id,
                'username', v_profile.username,
                'name', coalesce(nullif(v_profile.full_name, ''), v_profile.username, 'Santiago guest')
            )
        )
    )
    RETURNING id INTO v_submission_id;

    RETURN v_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_openmic_submission(UUID, TEXT) TO anon, authenticated;
