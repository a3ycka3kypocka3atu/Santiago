-- Migration: Add mentor/admin content submissions
-- Date: 2026-05-11
-- Purpose: Store mentor requests for profiles, services, projects, and events
-- before an admin publishes them to the public site or calendar.

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

CREATE POLICY "Staff can create submissions" ON public.submissions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
);

CREATE POLICY "Staff can read submissions" ON public.submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
);

CREATE POLICY "Admins can manage submissions" ON public.submissions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_submissions_kind_status ON public.submissions(kind, status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON public.submissions(submitted_by);
