-- Batch fixes migration (2026-07-12). Run in the Supabase SQL editor.
--
-- 1. documents.changes    - per-bullet tailoring diff so the UI can re-render
--                           the diff view later without exposing the full
--                           tailored resume text.
-- 2. job_filter_presets   - named, saveable job-finder filter sets.
-- 3. outreach_messages.is_manual - distinguishes messages the user logged
--                           themselves from AI-generated ones.
-- 4. subscriptions.trial_end - Stripe free-trial end timestamp.

-- Per-bullet tailoring diff persisted alongside the full text
ALTER TABLE documents ADD COLUMN IF NOT EXISTS changes jsonb;

-- Saved job-finder filter presets
CREATE TABLE IF NOT EXISTS job_filter_presets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_filter_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own filter presets" ON job_filter_presets;
CREATE POLICY "Users manage their own filter presets"
  ON job_filter_presets FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS job_filter_presets_user_idx
  ON job_filter_presets (user_id, created_at DESC);

-- Manually logged outreach messages (no AI generation involved)
ALTER TABLE outreach_messages ADD COLUMN IF NOT EXISTS is_manual boolean DEFAULT false;

-- Stripe free-trial support
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end timestamptz;
