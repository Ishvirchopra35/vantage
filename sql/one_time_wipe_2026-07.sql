-- ============================================================================
-- ONE-TIME DATA WIPE - July 2026 relaunch
-- ============================================================================
-- Run this ONCE in the Supabase SQL editor when you are ready to give every
-- user a fresh start. It deletes all app data for ALL users but keeps:
--   * auth.users rows (nobody has to sign up again)
--   * profiles identity columns (full_name, email, phone, extension_token)
--   * subscriptions (deleting these would desync Stripe billing)
--   * platform_limits (global shared quotas, not user data)
--   * rate_limit_logs (wiping them would let users evade current limits)
--
-- AFTER running this, also do (SQL cannot safely empty storage):
--   1. Supabase dashboard -> Storage -> `resumes` bucket -> Empty bucket
--   2. Supabase dashboard -> Storage -> `pdfs` bucket -> Empty bucket
--
-- THIS IS IRREVERSIBLE. Take a backup first if in doubt
-- (Database -> Backups, or pg_dump).
-- ============================================================================

BEGIN;

-- Leaf tables first so FK constraints never block the wipe.
DELETE FROM public.application_questions;
DELETE FROM public.outreach_messages;
DELETE FROM public.interview_sessions;
DELETE FROM public.strategy_feedback;
DELETE FROM public.ats_scores;
DELETE FROM public.documents;
DELETE FROM public.applications;
DELETE FROM public.job_feed_items;
DELETE FROM public.job_filter_presets;
DELETE FROM public.jobs;
DELETE FROM public.resumes;
DELETE FROM public.events;
DELETE FROM public.route_logs;

-- Clear career data from profiles but keep identity + extension pairing.
UPDATE public.profiles SET
  skills = NULL,
  target_roles = NULL,
  years_experience = NULL,
  university = NULL,
  graduation_year = NULL,
  linkedin_url = NULL,
  portfolio_url = NULL,
  github_url = NULL,
  experience = NULL,
  projects = NULL,
  resume_html = NULL,
  resume_pdf_path = NULL,
  cover_letter_template = NULL;

-- `location` and `degree` are optional columns that may not exist yet
-- (see app/api/extension/kit/route.ts). Cleared only if present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location') THEN
    UPDATE public.profiles SET location = NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'degree') THEN
    UPDATE public.profiles SET degree = NULL;
  END IF;
END $$;

COMMIT;

-- Sanity check afterwards: these should all return 0.
-- SELECT count(*) FROM public.applications;
-- SELECT count(*) FROM public.resumes;
-- SELECT count(*) FROM public.jobs;
