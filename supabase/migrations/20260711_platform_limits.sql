-- Platform-wide shared quotas for third-party APIs with account-level caps
-- (SerpApi monthly, Jina lifetime). Service-role only: RLS denies all clients.
--
-- Run this in the Supabase SQL editor if the platform_limits table is missing.
-- rate_limit_logs already exists in this project and is intentionally left alone.

CREATE TABLE IF NOT EXISTS platform_limits (
  key text PRIMARY KEY,
  count integer DEFAULT 0,
  window_start timestamptz DEFAULT now()
);

ALTER TABLE platform_limits ENABLE ROW LEVEL SECURITY;

-- No client (anon or authenticated) may read/write. The service role bypasses
-- RLS, so lib/rateLimit.ts (service client) is the only accessor.
DROP POLICY IF EXISTS "Only service role can access platform limits" ON platform_limits;
CREATE POLICY "Only service role can access platform limits"
ON platform_limits FOR ALL USING (false);

-- Atomic increment used by incrementSharedQuota(). SECURITY DEFINER so it runs
-- with the function owner's rights regardless of the (denied) RLS policy.
CREATE OR REPLACE FUNCTION increment_platform_limit(p_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE platform_limits SET count = count + 1 WHERE key = p_key;
$$;

-- Reference: rate_limit_logs (already present in this project).
-- CREATE TABLE IF NOT EXISTS rate_limit_logs (
--   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
--   key text NOT NULL,
--   user_id uuid NOT NULL,
--   created_at timestamptz DEFAULT now()
-- );
-- ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can only see their own rate limit logs"
--   ON rate_limit_logs FOR ALL USING (user_id = auth.uid());
-- CREATE INDEX IF NOT EXISTS rate_limit_logs_key_created
--   ON rate_limit_logs (key, created_at);
