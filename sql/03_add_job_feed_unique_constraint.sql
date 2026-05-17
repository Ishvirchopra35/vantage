-- Add unique constraint to job_feed_items for upsert support
-- Run this in Supabase SQL editor to enable job feed deduplication

ALTER TABLE public.job_feed_items 
ADD CONSTRAINT job_feed_items_user_external_unique 
UNIQUE (user_id, external_job_id);
