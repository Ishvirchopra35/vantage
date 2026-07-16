-- Atomic monthly-quota increment for consumeLimit() in lib/rateLimit.ts.
--
-- Before this, consumeLimit did a read-then-write compare-and-swap with 3
-- retries; under enough concurrent requests it could give up and silently
-- lose a charge. This function does counter = counter + 1 in one statement,
-- so concurrent requests can never lose an increment.
--
-- Run this in the Supabase SQL editor. Until it is run, the app keeps using
-- the old compare-and-swap path automatically (the code falls back when the
-- function is missing), so this is safe to apply at any time.

CREATE OR REPLACE FUNCTION increment_subscription_use(p_user_id uuid, p_column text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_value integer;
BEGIN
  -- Whitelist guards the dynamic SQL: only real usage-counter columns allowed.
  IF p_column NOT IN (
    'tailoring_uses',
    'cover_letter_uses',
    'auto_apply_uses',
    'strategy_uses',
    'networking_uses',
    'interview_uses'
  ) THEN
    RAISE EXCEPTION 'increment_subscription_use: invalid column %', p_column;
  END IF;

  EXECUTE format(
    'UPDATE public.subscriptions SET %I = COALESCE(%I, 0) + 1 WHERE user_id = $1 RETURNING %I',
    p_column, p_column, p_column
  )
  INTO new_value
  USING p_user_id;

  RETURN new_value;
END;
$$;

-- Service-role only: the app calls this through the service client. Without
-- the revoke, PostgREST exposes the function to any logged-in user (harmless
-- here - they could only burn their own quota - but there is no reason to
-- allow it).
REVOKE EXECUTE ON FUNCTION increment_subscription_use(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_subscription_use(uuid, text) TO service_role;

-- Same lockdown for the existing platform-limits increment: it was created
-- with the default grant, which let any authenticated user call it and
-- inflate the platform AI budget counter (bricking AI features for everyone).
REVOKE EXECUTE ON FUNCTION increment_platform_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_platform_limit(text) TO service_role;
