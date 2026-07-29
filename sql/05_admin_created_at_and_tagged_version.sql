-- ============================================================================
-- ADMIN ANALYTICS FIX + TAGGED DOCUMENT VERSIONING
-- Run this in the Supabase SQL editor after 04_tagged_resume_pipeline.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.created_at
--
-- /admin reads `profiles.created_at` for total users, new-this-week,
-- activation rate, both retention cohorts and the growth table. The column has
-- never existed - profiles only had `updated_at` - so that query errored, the
-- result was discarded unchecked, and every one of those metrics rendered as 0
-- or "-" no matter how many people signed up.
--
-- Added without a default first, so existing rows stay NULL and can be
-- backfilled with each user's REAL signup time from auth.users. Adding it with
-- DEFAULT now() would have stamped every existing user as having joined today
-- and quietly destroyed the signup history.
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE public.profiles p
SET created_at = u.created_at
FROM auth.users u
WHERE u.id = p.id
  AND p.created_at IS NULL;

-- Anything still NULL has no matching auth user (should not happen, but a
-- NULL here would silently drop the row out of every cohort calculation).
UPDATE public.profiles
SET created_at = COALESCE(updated_at, now())
WHERE created_at IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.profiles
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at);

-- The signup trigger must stamp it too, or every new user arrives with the
-- column defaulted at insert time rather than matching their auth record.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. resumes.tagged_version
--
-- Stamps which version of the parsing pipeline produced `tagged_doc`. When the
-- pipeline improves - project entries, section dedupe, hyperlink recovery -
-- every stored document is stale, and without this the only fix would be
-- asking every user to re-upload their resume.
--
-- Left at 0 for existing rows so they are all treated as stale and re-derived
-- from the original file on the user's next tailoring.
-- ----------------------------------------------------------------------------

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS tagged_version INT NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------------------
-- NOTE ON MISSING TABLES
--
-- `events`, `route_logs`, `costs` and `subscriptions` are read by /admin but
-- are not defined in any file in sql/ - they were created directly against the
-- database. That is why this class of drift went unnoticed: nothing in the
-- repo describes their shape, so nothing can be checked against it. The admin
-- page now surfaces failed queries instead of rendering them as zeroes, so the
-- next mismatch shows up immediately rather than as a number that never moves.
-- ----------------------------------------------------------------------------
