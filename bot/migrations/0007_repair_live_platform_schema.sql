-- Migration: Repair live platform schema
-- Date: 2026-05-13
-- Purpose: Bring the live Supabase project back in line with the website and bot code.
-- Safe to run more than once. It creates missing tables/columns/functions and does not delete data.

CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price TEXT,
    duration_minutes INTEGER,
    instructor_id UUID REFERENCES public.profiles(id),
    instructor_name TEXT,
    category TEXT DEFAULT 'body' CHECK (category IN ('body', 'mind', 'incubator', 'space')),
    format TEXT DEFAULT 'individual' CHECK (format IN ('individual', 'group')),
    location_type TEXT DEFAULT 'offline_studio' CHECK (location_type IN ('online', 'offline_studio', 'offline_external')),
    type TEXT DEFAULT 'public' CHECK (type IN ('public', 'club', 'internal')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    is_evergreen BOOLEAN DEFAULT false,
    recurrence_rule TEXT,
    detail_page TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS occupation TEXT,
    ADD COLUMN IF NOT EXISTS motivation TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'offline_studio'
        CHECK (location_type IN ('online', 'offline_studio', 'offline_external')),
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('profile', 'service', 'project', 'event')),
    title TEXT NOT NULL,
    description TEXT,
    details TEXT,
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    telegram_id BIGINT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_user ON public.bookings(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_format ON public.services(format);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON public.events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_service_id ON public.events(service_id);
CREATE INDEX IF NOT EXISTS idx_submissions_kind_status ON public.submissions(kind, status);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'services'
          AND policyname = 'Anyone can see published services'
    ) THEN
        CREATE POLICY "Anyone can see published services"
        ON public.services FOR SELECT
        USING (status = 'published');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'services'
          AND policyname = 'Staff can manage services'
    ) THEN
        CREATE POLICY "Staff can manage services"
        ON public.services FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('instructor', 'admin')
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'events'
          AND policyname = 'Anyone can see public events'
    ) THEN
        CREATE POLICY "Anyone can see public events"
        ON public.events FOR SELECT
        USING (type = 'public');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND policyname = 'Users can see own bookings'
    ) THEN
        CREATE POLICY "Users can see own bookings"
        ON public.bookings FOR SELECT
        USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND policyname = 'Staff can see all bookings'
    ) THEN
        CREATE POLICY "Staff can see all bookings"
        ON public.bookings FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('instructor', 'admin')
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND policyname = 'Residents can book'
    ) THEN
        CREATE POLICY "Residents can book"
        ON public.bookings FOR INSERT
        WITH CHECK (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'submissions'
          AND policyname = 'Staff can create submissions'
    ) THEN
        CREATE POLICY "Staff can create submissions"
        ON public.submissions FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role IN ('instructor', 'admin')
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'submissions'
          AND policyname = 'Staff can read submissions'
    ) THEN
        CREATE POLICY "Staff can read submissions"
        ON public.submissions FOR SELECT
        USING (
            submitted_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role = 'admin'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'submissions'
          AND policyname = 'Admins can manage submissions'
    ) THEN
        CREATE POLICY "Admins can manage submissions"
        ON public.submissions FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role = 'admin'
            )
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_profile_by_telegram_id(p_telegram_id BIGINT)
RETURNS TABLE (
    id UUID,
    telegram_id BIGINT,
    full_name TEXT,
    role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.id, p.telegram_id, p.full_name, p.role
    FROM public.profiles p
    WHERE p.telegram_id = p_telegram_id
    LIMIT 1;
$$;

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

    INSERT INTO public.bookings (event_id, user_id, status)
    VALUES (p_event_id, p_user_id, 'pending')
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_favorite(
    p_user_id UUID,
    p_item_type TEXT,
    p_item_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.favorites
    WHERE user_id = p_user_id
      AND item_type = p_item_type
      AND item_key = p_item_key;

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_favorites(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    item_type TEXT,
    item_key TEXT,
    title TEXT,
    subtitle TEXT,
    url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        f.id,
        f.item_type,
        f.item_key,
        f.title,
        f.subtitle,
        f.url,
        f.metadata,
        f.created_at,
        f.updated_at
    FROM public.favorites f
    WHERE f.user_id = p_user_id
    ORDER BY f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_by_telegram_id(BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_event_booking(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_favorite(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_favorites(UUID) TO anon, authenticated;

INSERT INTO public.services (
    slug,
    title,
    description,
    price,
    duration_minutes,
    instructor_name,
    category,
    format,
    location_type,
    type,
    status,
    is_evergreen,
    detail_page,
    updated_at
)
VALUES
    (
        'deep-massage',
        'Глубокий массаж и чайная церемония',
        'Терапевтический массаж с диагностикой тела, мужские и женские программы. Включает 30-60 мин чайной церемонии.',
        '1200 CZK · ≈ 48-50 EUR',
        120,
        'Ivan Protinak',
        'body',
        'individual',
        'offline_studio',
        'public',
        'published',
        false,
        'offer.html',
        NOW()
    ),
    (
        'wellness-katerina',
        'Wellness-программы и SPA-ретриты',
        'Телесные практики, ароматерапия, лимфодренажные тренировки, камерные SPA-ретриты с арома-ритуалами.',
        'Индивидуально',
        120,
        'Katerina',
        'body',
        'individual',
        'offline_studio',
        'public',
        'published',
        false,
        'offer-katerina.html',
        NOW()
    )
ON CONFLICT (slug)
DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    duration_minutes = EXCLUDED.duration_minutes,
    instructor_name = EXCLUDED.instructor_name,
    category = EXCLUDED.category,
    format = EXCLUDED.format,
    location_type = EXCLUDED.location_type,
    type = EXCLUDED.type,
    status = EXCLUDED.status,
    is_evergreen = EXCLUDED.is_evergreen,
    detail_page = EXCLUDED.detail_page,
    updated_at = NOW();

NOTIFY pgrst, 'reload schema';
