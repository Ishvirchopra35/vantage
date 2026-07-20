// SERVER-SIDE ONLY - never import this in client components.
//
// The outcome loop. Every other part of the app knows what the user did;
// this is the only part that knows what worked. It joins each application to
// the resume that was sent with it and the ATS score that resume earned, then
// compares response rates across those attributes.
//
// Deliberately statistical, not AI-generated: these numbers get shown to users
// and injected into prompts as fact, so they have to be derived from the data
// rather than inferred by a model that might invent a pattern.

import { createClient as createServiceClient } from '@supabase/supabase-js';

/** Terminal outcomes only. `applied` is still pending and must never be counted
 *  as a failure - doing so drags every rate toward zero and makes early users
 *  look like they are doing worse than they are. */
const RESPONDED: ReadonlySet<string> = new Set(['interviewing', 'offer']);
const NO_RESPONSE: ReadonlySet<string> = new Set(['rejected', 'ghosted']);

/** Below this many decided applications, individual differences are noise.
 *  Exported so the UI can show progress toward the same number it gates on. */
export const MIN_DECIDED_FOR_INSIGHTS = 15;

/** A single bucket needs at least this many applications on each side before
 *  its response rate means anything. */
const MIN_BUCKET = 5;

/** A bucket has to beat its comparison by this multiple to be worth showing.
 *  Anything under it is within the noise for samples this small. */
const MIN_LIFT = 1.4;

export interface OutcomeSignal {
  /** Human-readable attribute, e.g. "Resumes scoring 80+ on ATS". */
  factor: string;
  /** Response rate inside the bucket, as a percentage to 1dp. */
  respondedRate: number;
  /** Response rate outside it, for contrast. */
  comparisonRate: number;
  comparisonLabel: string;
  /** Applications inside the bucket. */
  sampleSize: number;
}

export interface OutcomeAnalysis {
  /** Applications with a terminal outcome (excludes still-pending `applied`). */
  decidedApplications: number;
  /** Decided applications that also have a resume attached. */
  linkedApplications: number;
  overallResponseRate: number;
  /** False until there is enough decided history for signals to mean anything. */
  confident: boolean;
  signals: OutcomeSignal[];
}

interface DecidedApp {
  responded: boolean;
  role: string;
  hasResume: boolean;
  atsScore: number | null;
  skillGapCount: number | null;
}

// Env is read per call rather than at module scope so the module can be
// imported before the environment is populated.
function serviceClient(): ReturnType<typeof createServiceClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service credentials');
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

function rate(rows: DecidedApp[]): number {
  if (rows.length === 0) return 0;
  const responded = rows.filter((r) => r.responded).length;
  return Math.round((responded / rows.length) * 1000) / 10;
}

/**
 * Splits decided applications on a predicate and returns a signal only if both
 * sides are big enough and the gap is large enough to not be noise.
 * A predicate returning null drops that row from the comparison entirely -
 * used for attributes that simply aren't known for some applications.
 */
function compareBuckets(
  rows: DecidedApp[],
  factor: string,
  comparisonLabel: string,
  predicate: (r: DecidedApp) => boolean | null
): OutcomeSignal | null {
  const inBucket: DecidedApp[] = [];
  const outBucket: DecidedApp[] = [];
  for (const row of rows) {
    const verdict = predicate(row);
    if (verdict === null) continue;
    (verdict ? inBucket : outBucket).push(row);
  }

  if (inBucket.length < MIN_BUCKET || outBucket.length < MIN_BUCKET) return null;

  const inRate = rate(inBucket);
  const outRate = rate(outBucket);

  // Only surface wins. "Your good resumes do worse" is almost always an
  // artifact of a small sample, and it is not actionable either way.
  if (outRate === 0 ? inRate === 0 : inRate / outRate < MIN_LIFT) return null;

  return {
    factor,
    respondedRate: inRate,
    comparisonRate: outRate,
    comparisonLabel,
    sampleSize: inBucket.length,
  };
}

export async function analyzeOutcomes(userId: string): Promise<OutcomeAnalysis> {
  const empty: OutcomeAnalysis = {
    decidedApplications: 0,
    linkedApplications: 0,
    overallResponseRate: 0,
    confident: false,
    signals: [],
  };

  try {
    const svc = serviceClient();

    const { data: appData } = await svc
      .from('applications')
      .select('status, role, resume_doc_id, ats_score_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    const apps = (appData ?? []) as Array<{
      status: string;
      role: string | null;
      resume_doc_id: string | null;
      ats_score_id: string | null;
    }>;

    const decided = apps.filter((a) => RESPONDED.has(a.status) || NO_RESPONSE.has(a.status));
    if (decided.length === 0) return empty;

    const docIds = [...new Set(decided.map((a) => a.resume_doc_id).filter((id): id is string => !!id))];
    const scoreIds = [...new Set(decided.map((a) => a.ats_score_id).filter((id): id is string => !!id))];

    const [docsResult, scoresResult] = await Promise.all([
      docIds.length > 0
        ? svc.from('documents').select('id, skill_gaps').in('id', docIds)
        : Promise.resolve({ data: [] }),
      scoreIds.length > 0
        ? svc.from('ats_scores').select('id, overall_score').in('id', scoreIds)
        : Promise.resolve({ data: [] }),
    ]);

    const gapsByDoc = new Map<string, number>();
    for (const doc of (docsResult.data ?? []) as Array<{ id: string; skill_gaps: string[] | null }>) {
      gapsByDoc.set(doc.id, (doc.skill_gaps ?? []).length);
    }

    const scoreById = new Map<string, number>();
    for (const s of (scoresResult.data ?? []) as Array<{ id: string; overall_score: number | null }>) {
      if (typeof s.overall_score === 'number') scoreById.set(s.id, s.overall_score);
    }

    const rows: DecidedApp[] = decided.map((a) => ({
      responded: RESPONDED.has(a.status),
      role: (a.role ?? '').trim(),
      hasResume: !!a.resume_doc_id,
      atsScore: a.ats_score_id ? scoreById.get(a.ats_score_id) ?? null : null,
      skillGapCount: a.resume_doc_id ? gapsByDoc.get(a.resume_doc_id) ?? null : null,
    }));

    const linked = rows.filter((r) => r.hasResume).length;
    const confident = rows.length >= MIN_DECIDED_FOR_INSIGHTS;

    const signals: OutcomeSignal[] = [];
    if (confident) {
      const candidates = [
        compareBuckets(
          rows,
          'Applications sent with a tailored resume',
          'applications without one',
          (r) => r.hasResume
        ),
        compareBuckets(
          rows,
          'Resumes scoring 80 or above on ATS',
          'resumes scoring below 80',
          (r) => (r.atsScore === null ? null : r.atsScore >= 80)
        ),
        compareBuckets(
          rows,
          'Resumes with two or fewer skill gaps',
          'resumes with more gaps',
          (r) => (r.skillGapCount === null ? null : r.skillGapCount <= 2)
        ),
      ];

      // Per-role, only for roles applied to often enough to compare.
      const roleCounts = new Map<string, number>();
      for (const r of rows) {
        if (r.role) roleCounts.set(r.role, (roleCounts.get(r.role) ?? 0) + 1);
      }
      for (const [role, count] of roleCounts) {
        if (count < MIN_BUCKET) continue;
        candidates.push(
          compareBuckets(rows, `Applications for ${role}`, 'your other roles', (r) =>
            r.role === role
          )
        );
      }

      for (const c of candidates) {
        if (c) signals.push(c);
      }
      signals.sort((a, b) => b.respondedRate - a.respondedRate);
    }

    return {
      decidedApplications: rows.length,
      linkedApplications: linked,
      overallResponseRate: rate(rows),
      confident,
      signals: signals.slice(0, 4),
    };
  } catch {
    // Never take down the caller. An AI route that loses this section still
    // has the rest of the user context to work with.
    return empty;
  }
}

export default { analyzeOutcomes, MIN_DECIDED_FOR_INSIGHTS };
