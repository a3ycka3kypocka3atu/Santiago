-- Migration: Add user favorites for events and services
-- Date: 2026-05-12
-- Purpose: Store saved events/services for Telegram-linked website profiles.

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

CREATE INDEX IF NOT EXISTS idx_favorites_user_type ON public.favorites(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_favorites_item ON public.favorites(item_type, item_key);

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
