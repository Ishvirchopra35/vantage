-- Onboarding walkthrough state.
--
-- Kept on the profile rather than in localStorage so the walkthrough follows
-- the user to a new browser or phone: someone who signs up on a laptop and
-- opens the app on their phone should not be walked through it a second time,
-- and someone who stopped at step 4 should be able to carry on from there.
--
-- One jsonb column rather than three booleans, because this will grow: the
-- shape is owned by lib/onboarding.ts and validated on read, so adding a field
-- later needs no migration.
--
--   {
--     "step": 4,           -- how far they got, 0-based
--     "completed": false,  -- reached the end
--     "skipped": false,    -- chose to skip
--     "seenAt": "2026-07-29T14:00:00.000Z"
--   }
--
-- NULL means "never started", which is what every existing row will be.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding jsonb;

COMMENT ON COLUMN public.profiles.onboarding IS
  'Product walkthrough progress. Shape owned by lib/onboarding.ts. NULL = never started.';

-- No policy changes needed: the existing profiles policies already scope a row
-- to its owner for both select and update, and this column rides along with
-- them. Nothing else may read it.
