-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'guest' CHECK (role IN ('guest', 'resident', 'instructor', 'admin')),
    bio TEXT,
    occupation TEXT,
    motivation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. SERVICES TABLE
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

-- 3. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    type TEXT DEFAULT 'public' CHECK (type IN ('public', 'club', 'internal')),
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    instructor_id UUID REFERENCES public.profiles(id),
    location_type TEXT DEFAULT 'offline_studio' CHECK (location_type IN ('online', 'offline_studio', 'offline_external')),
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    recurrence_rule TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 4. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 5. FAVORITES TABLE
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('event', 'service')),
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

-- 6. SUBMISSIONS TABLE
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

-- 7. RLS POLICIES

-- Profiles: Users can read their own profile, admins can read all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins/Instructors can read all profiles" ON public.profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'instructor'))
);

-- Events: 
-- 1. Public can see public events
CREATE POLICY "Anyone can see public events" ON public.events FOR SELECT USING (type = 'public');
-- 2. Residents can see club events
CREATE POLICY "Residents can see club events" ON public.events FOR SELECT USING (
    type = 'club' AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('resident', 'instructor', 'admin'))
    )
);
-- 3. Admins/Instructors can see all
CREATE POLICY "Staff can see all events" ON public.events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
);
-- 4. Instructors/Admins can insert/update events
CREATE POLICY "Staff can manage events" ON public.events FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
);

-- Bookings:
-- 1. Users can see their own bookings
CREATE POLICY "Users can see own bookings" ON public.bookings FOR SELECT USING (user_id = auth.uid());
-- 2. Admins/Instructors can see all bookings
CREATE POLICY "Staff can see all bookings" ON public.bookings FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
);
-- 3. Users can create bookings if they are at least resident (or public for public events - logic can be refined)
CREATE POLICY "Residents can book" ON public.bookings FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('resident', 'instructor', 'admin'))
);

-- Services:
-- 1. Anyone can see published services
CREATE POLICY "Anyone can see published services" ON public.services FOR SELECT USING (status = 'published');
-- 2. Staff can manage services
CREATE POLICY "Staff can manage services" ON public.services FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
);

-- Submissions:
-- Mentors/admins can create draft requests; admins/instructors can review them.
CREATE POLICY "Staff can create submissions" ON public.submissions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
);
CREATE POLICY "Staff can read submissions" ON public.submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
);
CREATE POLICY "Admins can manage submissions" ON public.submissions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Public login bridge:
-- The website receives a Telegram ID from the bot link, then asks for only
-- the minimal profile fields needed to render the correct UI role.
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

GRANT EXECUTE ON FUNCTION public.get_profile_by_telegram_id(BIGINT) TO anon, authenticated;

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

GRANT EXECUTE ON FUNCTION public.request_event_booking(UUID, UUID) TO anon, authenticated;

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
    IF p_item_type NOT IN ('event', 'service') THEN
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

GRANT EXECUTE ON FUNCTION public.upsert_favorite(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_favorite(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_favorites(UUID) TO anon, authenticated;

-- 8. INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_user ON public.bookings(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_kind_status ON public.submissions(kind, status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON public.submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_favorites_user_type ON public.favorites(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_favorites_item ON public.favorites(item_type, item_key);
CREATE INDEX IF NOT EXISTS idx_events_service_id ON public.events(service_id);
CREATE INDEX IF NOT EXISTS idx_events_location_type ON public.events(location_type);
CREATE INDEX IF NOT EXISTS idx_events_recurrence ON public.events(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_slug ON public.services(slug);
CREATE INDEX IF NOT EXISTS idx_services_location_type ON public.services(location_type);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_format ON public.services(format);
