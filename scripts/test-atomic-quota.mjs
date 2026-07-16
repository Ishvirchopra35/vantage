// Concurrency test for increment_subscription_use() (20260716 migration).
// Fires 50 parallel RPC calls at one user's tailoring_uses counter and checks
// the counter moved by exactly 50 - the old read-then-write path would lose
// some under this load. Restores the original counter value when done.
//
// Usage (from the project root, after running the migration in Supabase):
//   node scripts/test-atomic-quota.mjs [user_id]
//
// Uses the service role key from .env.local, so it must run locally only.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const CALLS = 50;

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv('.env.local');
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const svc = createClient(url, key, { auth: { persistSession: false } });

// Pick the target user: CLI arg, or the first subscriptions row.
let userId = process.argv[2];
if (!userId) {
  const { data, error } = await svc.from('subscriptions').select('user_id').limit(1).single();
  if (error || !data) {
    console.error('No subscriptions row found to test against. Pass a user_id explicitly.');
    process.exit(1);
  }
  userId = data.user_id;
}

const { data: beforeRow, error: beforeErr } = await svc
  .from('subscriptions')
  .select('tailoring_uses')
  .eq('user_id', userId)
  .single();
if (beforeErr || !beforeRow) {
  console.error(`No subscriptions row for user ${userId}`);
  process.exit(1);
}
const before = Number(beforeRow.tailoring_uses) || 0;
console.log(`User: ${userId}`);
console.log(`tailoring_uses before: ${before}`);
console.log(`Firing ${CALLS} parallel increments...`);

const results = await Promise.all(
  Array.from({ length: CALLS }, () =>
    svc.rpc('increment_subscription_use', { p_user_id: userId, p_column: 'tailoring_uses' })
  )
);
const failures = results.filter((r) => r.error);
if (failures.length) {
  const msg = failures[0].error.message ?? '';
  if (/function|schema cache|not exist/i.test(msg)) {
    console.error('RPC failed - the SQL function is not in the database yet.');
    console.error('Run supabase/migrations/20260716_atomic_subscription_increment.sql in the Supabase SQL editor first.');
  } else {
    console.error(`${failures.length}/${CALLS} RPC calls errored. First error: ${msg}`);
  }
  process.exit(1);
}

const { data: afterRow } = await svc
  .from('subscriptions')
  .select('tailoring_uses')
  .eq('user_id', userId)
  .single();
const after = Number(afterRow?.tailoring_uses) || 0;
console.log(`tailoring_uses after:  ${after}`);

// Restore the counter so the test leaves no trace.
const { error: restoreErr } = await svc
  .from('subscriptions')
  .update({ tailoring_uses: before })
  .eq('user_id', userId);
console.log(restoreErr ? `WARNING: failed to restore counter to ${before} - reset it manually.` : `Counter restored to ${before}.`);

const delta = after - before;
if (delta === CALLS) {
  console.log(`\nPASS: ${CALLS} concurrent calls -> counter moved by exactly ${CALLS}. No lost increments.`);
} else {
  console.log(`\nFAIL: counter moved by ${delta}, expected ${CALLS}. Increments were lost or double-counted.`);
  process.exit(1);
}

// Whitelist check: a non-counter column must be rejected.
const { error: badColErr } = await svc.rpc('increment_subscription_use', {
  p_user_id: userId,
  p_column: 'plan',
});
console.log(
  badColErr
    ? `PASS: non-whitelisted column 'plan' was rejected (${badColErr.message}).`
    : `FAIL: incrementing 'plan' was NOT rejected - check the whitelist in the SQL function.`
);
