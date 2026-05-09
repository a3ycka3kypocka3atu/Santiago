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

-- 2. EVENTS TABLE
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

-- 3. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 4. SERVICES TABLE
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price TEXT,
    duration_minutes INTEGER,
    instructor_id UUID REFERENCES public.profiles(id),
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

-- 5. RLS POLICIES

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

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_events_service_id ON public.events(service_id);
CREATE INDEX IF NOT EXISTS idx_events_location_type ON public.events(location_type);
CREATE INDEX IF NOT EXISTS idx_events_recurrence ON public.events(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_slug ON public.services(slug);
CREATE INDEX IF NOT EXISTS idx_services_location_type ON public.services(location_type);
