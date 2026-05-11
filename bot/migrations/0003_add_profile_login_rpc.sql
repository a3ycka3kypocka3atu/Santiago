-- Migration: Add safe profile lookup for Telegram bot login
-- Date: 2026-05-11
-- Purpose: Let the public website resolve a bot-provided Telegram ID without
-- exposing the full profiles table or trusting role query parameters.

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

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_user ON public.bookings(event_id, user_id);
