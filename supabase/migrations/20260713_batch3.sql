-- ============================================================================
-- Batch 3 migration - July 2026
-- Run in the Supabase SQL editor (like the previous migration files).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Marketing emails (W2)
-- marketing_emails_enabled: master opt-in flag, default off.
-- unsubscribe_token: unguessable id embedded in every email's unsubscribe
-- link so opting out works without logging in.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_emails_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unsub_token
  ON public.profiles (unsubscribe_token);

-- Backfill consent from the signup checkbox, which until now only lived in
-- auth.users metadata (raw_user_meta_data.marketing_opt_in).
UPDATE public.profiles p
SET marketing_emails_enabled = true
FROM auth.users u
WHERE u.id = p.id
  AND (u.raw_user_meta_data ->> 'marketing_opt_in')::boolean IS TRUE;

-- ---------------------------------------------------------------------------
-- Indexes (W10 scalability pass)
-- rate_limit_logs is read on every rate-limited API call (user + key +
-- window); events/route_logs power the admin dashboard; applications is
-- filtered by user + deleted_at on most dashboard pages.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_user_key_created
  ON public.rate_limit_logs (user_id, key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON public.events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_logs_created_at
  ON public.route_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_user_deleted
  ON public.applications (user_id, deleted_at);
