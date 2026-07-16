-- Fix (2026-07-15): two foreign keys referenced auth.users without ON DELETE
-- CASCADE, unlike every other user-owned table. Either one left a dangling
-- foreign key that blocked deleting an auth user ("Database error deleting
-- user"). Swap both constraints for cascading ones so deleting a user cleans
-- up their rows.
--
--   1. job_filter_presets.user_id - never had cascade (added 2026-07-12).
--   2. subscriptions.user_id       - the live DB drifted to NO ACTION even
--      though the base schema declares it as cascade; this realigns it.
--
-- Run in the Supabase SQL editor.

ALTER TABLE public.job_filter_presets
  DROP CONSTRAINT job_filter_presets_user_id_fkey,
  ADD CONSTRAINT job_filter_presets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT subscriptions_user_id_fkey,
  ADD CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
