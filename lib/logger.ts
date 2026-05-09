/**
 * Route logging helper — writes to `route_logs` using the service role key.
 * This function must never throw; failures are swallowed.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sqlCreate = `-- SQL for route_logs table
CREATE TABLE IF NOT EXISTS route_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  user_id uuid NULL,
  duration_ms integer NOT NULL,
  status_code integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Note: No RLS on this table; writes performed with service role key.`;

export async function logRoute(route: string, userId: string | null, durationMs: number, statusCode: number): Promise<void> {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return;

    const svc = createServiceClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    await svc.from('route_logs').insert({
      route,
      user_id: userId,
      duration_ms: Math.floor(durationMs),
      status_code: statusCode,
    });
  } catch (e) {
    // Fail silently — logging should not impact the request
    return;
  }
}

export { sqlCreate as routeLogsTableSQL };

export default logRoute;
