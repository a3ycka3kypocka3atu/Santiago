-- Migration: Add provider model to services
-- Date: 2026-05-19
-- Purpose: Distinguish personal services from project/team-provided services.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'person'
    CHECK (provider_type IN ('person', 'project')),
  ADD COLUMN IF NOT EXISTS provider_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_slug TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT;

COMMENT ON COLUMN public.services.provider_type IS 'Service provider kind: person for personal services, project for project/team-provided services';
COMMENT ON COLUMN public.services.provider_name IS 'Display name of the person or project/team that provides the service';
COMMENT ON COLUMN public.services.provider_slug IS 'Stable provider key used for filtering and linking services';
COMMENT ON COLUMN public.services.contact_person IS 'Human contact person for project/team-provided services';

UPDATE public.services
SET
  provider_type = coalesce(provider_type, 'person'),
  provider_name = coalesce(nullif(provider_name, ''), nullif(instructor_name, ''), 'Santiago provider'),
  provider_slug = coalesce(
    nullif(provider_slug, ''),
    lower(regexp_replace(
      translate(coalesce(nullif(instructor_name, ''), slug), 'ÁÀÂÄÃÅáàâäãåČčĎďÉÈÊËéèêëÍÌÎÏíìîïŇňÓÒÔÖÕóòôöõŘřŠšŤťÚÙÛÜúùûüÝýŽž', 'AAAAAAaaaaaaCcDdEEEEeeeeIIIIiiiiNnOOOOOoooooRrSsTtUUUUuuuuYyZz'),
      '[^a-zA-Z0-9]+',
      '',
      'g'
    ))
  )
WHERE provider_name IS NULL
   OR provider_slug IS NULL
   OR provider_type IS NULL;

UPDATE public.services
SET
  provider_type = 'project',
  provider_name = 'Ethical Marketing & Automation Agency',
  provider_slug = 'ethical-automation-agency',
  contact_person = 'Andrij Pýcha'
WHERE slug = 'startup-marketing-automation';

UPDATE public.services
SET
  provider_type = 'project',
  provider_name = 'Conscious Networking Platform',
  provider_slug = 'andrij-network-platform',
  contact_person = 'Andrij Pýcha'
WHERE slug = 'conscious-networking-facilitation';

UPDATE public.services
SET
  provider_type = 'project',
  provider_name = 'Santiago Talks & Interviews',
  provider_slug = 'santiago-interviews',
  contact_person = 'Andrij Pýcha'
WHERE slug = 'interview-recording-production';

UPDATE public.services
SET
  provider_type = 'project',
  provider_name = 'Conscious Relationships Platform',
  provider_slug = 'conscious-relationships',
  contact_person = 'Andrij Pýcha'
WHERE slug = 'conscious-relationship-discovery';

UPDATE public.services
SET
  provider_type = 'project',
  provider_name = 'Alternative Knowledge Lab',
  provider_slug = 'alternative-knowledge-lab',
  contact_person = 'Andrij Pýcha'
WHERE slug = 'alternative-knowledge-workshop';

CREATE INDEX IF NOT EXISTS idx_services_provider_type ON public.services(provider_type);
CREATE INDEX IF NOT EXISTS idx_services_provider_slug ON public.services(provider_slug);

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
            'provider', jsonb_build_object(
                'type', coalesce(nullif(v_service.provider_type, ''), 'person'),
                'name', nullif(v_service.provider_name, ''),
                'slug', nullif(v_service.provider_slug, ''),
                'contact_person', nullif(v_service.contact_person, '')
            ),
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

GRANT EXECUTE ON FUNCTION public.request_service_booking(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
