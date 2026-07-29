// SERVER-SIDE ONLY - fetches an uploaded resume back out of storage.
//
// Both the template loader and the tagged-document backfill need the original
// file rather than the text that was extracted from it. For the backfill that
// distinction is the whole point: resumes uploaded before this pipeline
// existed have a `raw_text` produced by an extractor that discarded hyperlink
// targets, so re-reading the stored text would carry that loss forward
// forever. Going back to the file recovers the links.

import { createClient as createServiceClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const RESUME_BUCKET = 'resumes';

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase service credentials');
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/**
 * Downloads an object from the private resumes bucket, or null if it is gone.
 *
 * Callers have already authenticated the user and know whose file they are
 * asking for, so the service-role client is used to skip a signed-URL round
 * trip. `path` must therefore never come from a request body - only from a
 * database row belonging to the caller.
 */
export async function downloadResumeFile(path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await serviceClient().storage.from(RESUME_BUCKET).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    // A missing file is a normal outcome (deleted account, cleared storage),
    // not an error worth failing a download or a tailoring over.
    return null;
  }
}
