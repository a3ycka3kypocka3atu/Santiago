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
    capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 4. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 5. EVENT PARTICIPATIONS TABLE
CREATE TABLE IF NOT EXISTS public.event_participations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'attending' CHECK (status IN ('attending', 'cancelled')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility = 'public'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_participations ENABLE ROW LEVEL SECURITY;

-- 6. FAVORITES TABLE
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('event', 'service', 'mentor', 'project', 'content')),
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

-- 7. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('event', 'service', 'mentor', 'project', 'content')),
    target_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    source TEXT NOT NULL DEFAULT 'favorite_auto' CHECK (source IN ('favorite_auto', 'explicit_subscribe', 'booking', 'admin')),
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, target_type, target_key, source)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 8. SUBSCRIPTION NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('event', 'service', 'mentor', 'project', 'content')),
    target_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    send_at TIMESTAMPTZ NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_notifications ENABLE ROW LEVEL SECURITY;

-- 9. SUBMISSIONS TABLE
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

-- 10. RLS POLICIES

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
-- 2. Instructors can see private bookings only for events/services they own.
CREATE POLICY "Instructors can see own event bookings" ON public.bookings FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.events e
        LEFT JOIN public.services s ON s.id = e.service_id
        WHERE e.id = bookings.event_id
          AND (e.instructor_id = auth.uid() OR s.instructor_id = auth.uid())
    )
);
-- 3. Users can create bookings if they are at least resident (or public for public events - logic can be refined)
CREATE POLICY "Residents can book" ON public.bookings FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('resident', 'instructor', 'admin'))
);

-- Event participations:
CREATE POLICY "Anyone can see public event participations" ON public.event_participations FOR SELECT USING (
    visibility = 'public' AND status = 'attending'
);
CREATE POLICY "Users can manage own event participation" ON public.event_participations FOR ALL USING (
    user_id = auth.uid()
) WITH CHECK (
    user_id = auth.uid()
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

    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE event_id = p_event_id
      AND user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_booking_id IS NOT NULL THEN
        UPDATE public.bookings
        SET status = 'pending'
        WHERE id = v_booking_id
          AND status IN ('cancelled', 'rejected');

        RETURN v_booking_id;
    END IF;

    INSERT INTO public.bookings (event_id, user_id, status)
    VALUES (p_event_id, p_user_id, 'pending')
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_event_booking(UUID, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_booking_status(
    p_user_id UUID,
    p_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
    event_id UUID,
    status TEXT,
    title TEXT,
    start_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT b.event_id, b.status, e.title, e.start_time, b.created_at
    FROM public.bookings b
    LEFT JOIN public.events e ON e.id = b.event_id
    WHERE b.user_id = p_user_id
      AND (p_event_ids IS NULL OR b.event_id = ANY(p_event_ids))
    ORDER BY b.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.upsert_event_participation(
    p_event_id UUID,
    p_user_id UUID,
    p_attending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event public.events%ROWTYPE;
    v_user_role TEXT;
    v_status TEXT := CASE WHEN p_attending THEN 'attending' ELSE 'cancelled' END;
    v_count BIGINT;
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

    INSERT INTO public.event_participations (
        event_id,
        user_id,
        status,
        visibility,
        updated_at
    )
    VALUES (
        p_event_id,
        p_user_id,
        v_status,
        'public',
        NOW()
    )
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW();

    SELECT count(*) INTO v_count
    FROM public.event_participations
    WHERE event_id = p_event_id
      AND status = 'attending';

    RETURN jsonb_build_object(
        'event_id', p_event_id,
        'is_attending', p_attending,
        'participant_count', v_count,
        'capacity', v_event.capacity
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_public_stats(p_event_ids UUID[])
RETURNS TABLE (
    event_id UUID,
    capacity INTEGER,
    participant_count BIGINT,
    participants JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        e.id AS event_id,
        e.capacity,
        count(ep.id) FILTER (WHERE ep.status = 'attending') AS participant_count,
        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'profile_id', p.id,
                    'name', coalesce(nullif(p.full_name, ''), p.username, 'Santiago user'),
                    'username', p.username
                )
                ORDER BY ep.created_at
            ) FILTER (WHERE ep.status = 'attending'),
            '[]'::jsonb
        ) AS participants
    FROM public.events e
    LEFT JOIN public.event_participations ep ON ep.event_id = e.id
    LEFT JOIN public.profiles p ON p.id = ep.user_id
    WHERE e.id = ANY(p_event_ids)
    GROUP BY e.id, e.capacity;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_submissions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    kind TEXT,
    title TEXT,
    description TEXT,
    details TEXT,
    status TEXT,
    display_status TEXT,
    admin_message TEXT,
    published_url TEXT,
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
        s.kind,
        s.title,
        s.description,
        s.details,
        s.status,
        coalesce(nullif(s.payload->>'workflow_status', ''), s.status) AS display_status,
        nullif(s.payload->>'admin_message', '') AS admin_message,
        nullif(s.payload->>'published_url', '') AS published_url,
        s.created_at,
        s.updated_at
    FROM public.submissions s
    WHERE s.submitted_by = p_user_id
    ORDER BY s.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_mentor_activity_summary(p_user_id UUID)
RETURNS TABLE (
    item_type TEXT,
    item_id TEXT,
    title TEXT,
    status TEXT,
    start_time TIMESTAMPTZ,
    favorite_count BIGINT,
    booking_count BIGINT,
    confirmed_booking_count BIGINT,
    participant_count BIGINT,
    capacity INTEGER,
    url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH owned_events AS (
        SELECT e.*
        FROM public.events e
        LEFT JOIN public.services s ON s.id = e.service_id
        WHERE e.instructor_id = p_user_id
           OR s.instructor_id = p_user_id
    ),
    event_rows AS (
        SELECT
            'event'::text AS item_type,
            e.id::text AS item_id,
            e.title,
            e.status,
            e.start_time,
            count(DISTINCT f.id) AS favorite_count,
            count(DISTINCT b.id) AS booking_count,
            count(DISTINCT b.id) FILTER (WHERE b.status = 'confirmed') AS confirmed_booking_count,
            count(DISTINCT ep.id) FILTER (WHERE ep.status = 'attending') AS participant_count,
            e.capacity,
            'calendar.html'::text AS url
        FROM owned_events e
        LEFT JOIN public.favorites f ON f.item_type = 'event' AND f.item_key = e.id::text
        LEFT JOIN public.bookings b ON b.event_id = e.id
        LEFT JOIN public.event_participations ep ON ep.event_id = e.id
        GROUP BY e.id, e.title, e.status, e.start_time, e.capacity
    ),
    service_rows AS (
        SELECT
            'service'::text AS item_type,
            s.slug AS item_id,
            s.title,
            s.status,
            NULL::timestamptz AS start_time,
            count(DISTINCT f.id) AS favorite_count,
            0::bigint AS booking_count,
            0::bigint AS confirmed_booking_count,
            0::bigint AS participant_count,
            NULL::integer AS capacity,
            s.detail_page AS url
        FROM public.services s
        LEFT JOIN public.favorites f ON f.item_type = 'service' AND f.item_key = s.slug
        WHERE s.instructor_id = p_user_id
        GROUP BY s.slug, s.title, s.status, s.detail_page
    )
    SELECT *
    FROM event_rows
    UNION ALL
    SELECT *
    FROM service_rows
    ORDER BY start_time DESC NULLS LAST, title;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_platform_overview(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_result JSONB;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_role <> 'admin' THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;

    SELECT jsonb_build_object(
        'profiles_by_role', (
            SELECT coalesce(jsonb_object_agg(role, count), '{}'::jsonb)
            FROM (
                SELECT role, count(*) AS count
                FROM public.profiles
                GROUP BY role
            ) grouped
        ),
        'submissions_by_status', (
            SELECT coalesce(jsonb_object_agg(display_status, count), '{}'::jsonb)
            FROM (
                SELECT coalesce(nullif(payload->>'workflow_status', ''), status) AS display_status,
                       count(*) AS count
                FROM public.submissions
                GROUP BY coalesce(nullif(payload->>'workflow_status', ''), status)
            ) grouped
        ),
        'events', (
            SELECT jsonb_build_object(
                'total', count(*),
                'confirmed', count(*) FILTER (WHERE status = 'confirmed'),
                'pending', count(*) FILTER (WHERE status = 'pending'),
                'cancelled', count(*) FILTER (WHERE status = 'cancelled')
            )
            FROM public.events
        ),
        'services', (
            SELECT jsonb_build_object(
                'total', count(*),
                'published', count(*) FILTER (WHERE status = 'published'),
                'draft', count(*) FILTER (WHERE status = 'draft')
            )
            FROM public.services
        ),
        'bookings_by_status', (
            SELECT coalesce(jsonb_object_agg(status, count), '{}'::jsonb)
            FROM (
                SELECT status, count(*) AS count
                FROM public.bookings
                GROUP BY status
            ) grouped
        ),
        'public_participations', (
            SELECT count(*)
            FROM public.event_participations
            WHERE status = 'attending'
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_booking_status(UUID, UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_event_participation(UUID, UUID, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_public_stats(UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_submissions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mentor_activity_summary(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_overview(UUID) TO anon, authenticated;

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
    IF p_item_type NOT IN ('event', 'service', 'mentor', 'project', 'content') THEN
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

CREATE OR REPLACE FUNCTION public.upsert_event_reminder_subscription(
    p_user_id UUID,
    p_target_key TEXT,
    p_title TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ DEFAULT NULL,
    p_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription public.subscriptions%ROWTYPE;
    v_offset INTEGER;
    v_send_at TIMESTAMPTZ;
    v_kind TEXT;
    v_title TEXT;
    v_url TEXT;
    v_metadata JSONB;
    v_count INTEGER := 0;
BEGIN
    IF p_user_id IS NULL OR p_target_key IS NULL OR length(trim(p_target_key)) = 0 THEN
        RAISE EXCEPTION 'invalid_subscription_payload';
    END IF;

    IF p_start_time IS NULL THEN
        RAISE EXCEPTION 'event_start_time_required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    v_title := coalesce(nullif(trim(coalesce(p_title, '')), ''), p_target_key);
    v_url := nullif(trim(coalesce(p_url, '')), '');
    v_metadata := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'title', v_title,
        'start_time', p_start_time,
        'end_time', p_end_time,
        'url', v_url
    );

    INSERT INTO public.subscriptions (
        user_id,
        target_type,
        target_key,
        status,
        source,
        preferences,
        metadata,
        updated_at
    )
    VALUES (
        p_user_id,
        'event',
        trim(p_target_key),
        'active',
        'favorite_auto',
        jsonb_build_object('event_reminders', true, 'offset_minutes', jsonb_build_array(1440, 180)),
        v_metadata,
        NOW()
    )
    ON CONFLICT (user_id, target_type, target_key, source)
    DO UPDATE SET
        status = 'active',
        preferences = jsonb_build_object('event_reminders', true, 'offset_minutes', jsonb_build_array(1440, 180)),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING * INTO v_subscription;

    UPDATE public.subscription_notifications
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE subscription_id = v_subscription.id
      AND status = 'pending'
      AND kind IN ('event_reminder_24h', 'event_reminder_3h');

    FOREACH v_offset IN ARRAY ARRAY[1440, 180]
    LOOP
        v_send_at := p_start_time - (v_offset || ' minutes')::interval;
        v_kind := CASE
            WHEN v_offset = 1440 THEN 'event_reminder_24h'
            ELSE 'event_reminder_3h'
        END;

        IF p_start_time > NOW() AND v_send_at > NOW() THEN
            INSERT INTO public.subscription_notifications (
                subscription_id,
                user_id,
                target_type,
                target_key,
                kind,
                send_at,
                payload,
                status,
                updated_at
            )
            VALUES (
                v_subscription.id,
                p_user_id,
                'event',
                trim(p_target_key),
                v_kind,
                v_send_at,
                jsonb_build_object(
                    'title', v_title,
                    'start_time', p_start_time,
                    'end_time', p_end_time,
                    'url', v_url,
                    'offset_minutes', v_offset,
                    'metadata', v_metadata
                ),
                'pending',
                NOW()
            )
            ON CONFLICT (subscription_id, kind) WHERE status = 'pending'
            DO UPDATE SET
                send_at = EXCLUDED.send_at,
                payload = EXCLUDED.payload,
                updated_at = NOW();

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'subscription_id', v_subscription.id,
        'status', v_subscription.status,
        'scheduled_count', v_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_event_reminder_subscription(
    p_user_id UUID,
    p_target_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription_id UUID;
BEGIN
    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND target_type = 'event'
      AND target_key = p_target_key
      AND source = 'favorite_auto'
    LIMIT 1;

    IF v_subscription_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.subscriptions
    SET status = 'paused',
        preferences = jsonb_set(
            coalesce(preferences, '{}'::jsonb),
            '{event_reminders}',
            'false'::jsonb,
            true
        ),
        updated_at = NOW()
    WHERE id = v_subscription_id;

    UPDATE public.subscription_notifications
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE subscription_id = v_subscription_id
      AND status = 'pending';

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_subscriptions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    target_type TEXT,
    target_key TEXT,
    status TEXT,
    source TEXT,
    preferences JSONB,
    metadata JSONB,
    pending_count BIGINT,
    next_send_at TIMESTAMPTZ,
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
        s.target_type,
        s.target_key,
        s.status,
        s.source,
        s.preferences,
        s.metadata,
        count(n.id) FILTER (WHERE n.status = 'pending') AS pending_count,
        min(n.send_at) FILTER (WHERE n.status = 'pending') AS next_send_at,
        s.created_at,
        s.updated_at
    FROM public.subscriptions s
    LEFT JOIN public.subscription_notifications n ON n.subscription_id = s.id
    WHERE s.user_id = p_user_id
    GROUP BY s.id
    ORDER BY s.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_event_reminder_subscription(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_event_reminder_subscription(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_subscriptions(UUID) TO anon, authenticated;

-- 10. INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_user ON public.bookings(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_event_participations_event_status ON public.event_participations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_participations_user ON public.event_participations(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_kind_status ON public.submissions(kind, status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON public.submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_favorites_user_type ON public.favorites(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_favorites_item ON public.favorites(item_type, item_key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_target ON public.subscriptions(user_id, target_type, target_key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_target ON public.subscriptions(target_type, target_key);
CREATE INDEX IF NOT EXISTS idx_subscription_notifications_due ON public.subscription_notifications(status, send_at);
CREATE INDEX IF NOT EXISTS idx_subscription_notifications_user ON public.subscription_notifications(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_notifications_pending_kind
    ON public.subscription_notifications(subscription_id, kind)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_events_service_id ON public.events(service_id);
CREATE INDEX IF NOT EXISTS idx_events_location_type ON public.events(location_type);
CREATE INDEX IF NOT EXISTS idx_events_recurrence ON public.events(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_slug ON public.services(slug);
CREATE INDEX IF NOT EXISTS idx_services_location_type ON public.services(location_type);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_format ON public.services(format);
