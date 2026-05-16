import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, rateLimited, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkLimit, LIMITS } from '@/lib/rateLimit';
import { createClient } from '@/lib/supabase/server';

export interface ApplicationRow {
  id: string;
  user_id: string;
  job_id: string | null;
  job_title: string | null;
  company: string;
  role: string;
  job_url: string | null;
  status: 'applied' | 'interviewing' | 'rejected' | 'offer' | 'ghosted';
  applied_date: string | null;
  resume_doc_id: string | null;
  cover_letter_doc_id: string | null;
  ats_score_id: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  // enriched via batch lookup
  job_company: string | null;
  overall_score: number | null;
}

export async function GET(_request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const supabase = await createClient();

    const [applicationsResult, limitResult] = await Promise.all([
      supabase
        .from('applications')
        .select(
          'id, user_id, job_id, job_title, company, role, job_url, status, applied_date, resume_doc_id, cover_letter_doc_id, ats_score_id, notes, deleted_at, created_at'
        )
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      checkLimit(user.id, 'applications'),
    ]);

    if (applicationsResult.error) {
      await logRoute('/api/applications', user.id, Date.now() - start, 500);
      return serverError(new Error(applicationsResult.error.message));
    }

    const appRows = applicationsResult.data ?? [];

    // Batch-fetch related jobs and ats_scores in parallel (avoids relying on
    // PostgREST FK inference which requires explicit DB constraints to exist)
    const jobIds = [...new Set(appRows.map(r => r.job_id).filter(Boolean))] as string[];
    const atsIds = [...new Set(appRows.map(r => r.ats_score_id).filter(Boolean))] as string[];

    const [jobsResult, atsResult] = await Promise.all([
      jobIds.length
        ? supabase.from('jobs').select('id, title, company').in('id', jobIds)
        : Promise.resolve({ data: [] as { id: string; title: string; company: string }[], error: null }),
      atsIds.length
        ? supabase.from('ats_scores').select('id, overall_score').in('id', atsIds)
        : Promise.resolve({ data: [] as { id: string; overall_score: number }[], error: null }),
    ]);

    const jobMap = new Map((jobsResult.data ?? []).map(j => [j.id, j]));
    const atsMap = new Map((atsResult.data ?? []).map(a => [a.id, a]));

    const rows: ApplicationRow[] = appRows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      job_id: row.job_id,
      job_title: row.job_title ?? null,
      company: row.company,
      role: row.role,
      job_url: row.job_url,
      status: row.status,
      applied_date: row.applied_date ?? null,
      resume_doc_id: row.resume_doc_id,
      cover_letter_doc_id: row.cover_letter_doc_id,
      ats_score_id: row.ats_score_id,
      notes: row.notes,
      deleted_at: row.deleted_at ?? null,
      created_at: row.created_at,
      job_company: row.job_id ? (jobMap.get(row.job_id)?.company ?? null) : null,
      overall_score: row.ats_score_id ? (atsMap.get(row.ats_score_id)?.overall_score ?? null) : null,
    }));

    const atLimit = limitResult.remaining === 0;

    await logRoute('/api/applications', user.id, Date.now() - start, 200);
    return ok({ applications: rows, atLimit });
  } catch (e) {
    await logRoute('/api/applications', user.id, Date.now() - start, 500);
    return serverError(e);
  }
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const body = await request.json().catch(() => null);
  const validation = validateBody<{
    company: string;
    role: string;
    status: string;
    job_url?: string;
    job_id?: string;
    applied_date?: string;
    notes?: string;
    ats_score_id?: string;
  }>(body, ['company', 'role', 'status']);
  if (!validation.valid) return err(validation.error, 400);
  const { company, role, status, job_url, job_id, applied_date, notes, ats_score_id } = validation.data;

  const limitCheck = await checkLimit(user.id, 'applications');
  if (!limitCheck.allowed) {
    await logRoute('/api/applications', user.id, Date.now() - start, 429);
    return rateLimited('application tracking', LIMITS.applications, 0);
  }

  try {
    const supabase = await createClient();

    const { data: newRow, error: insertError } = await supabase
      .from('applications')
      .insert({
        user_id: user.id,
        company,
        role,
        status,
        job_url: job_url ?? null,
        job_id: job_id ?? null,
        applied_date: applied_date ?? null,
        notes: notes ?? null,
        ats_score_id: ats_score_id ?? null,
      })
      .select(
        'id, user_id, job_id, job_title, company, role, job_url, status, applied_date, resume_doc_id, cover_letter_doc_id, ats_score_id, notes, deleted_at, created_at'
      )
      .single();

    if (insertError || !newRow) {
      await logRoute('/api/applications', user.id, Date.now() - start, 500);
      return serverError(new Error(insertError?.message ?? 'Failed to create application'));
    }

    void Promise.resolve(
      supabase.from('events').insert({
        user_id: user.id,
        event_name: 'logged_application',
        properties: { company, role, status },
      })
    ).catch(() => {});

    await logRoute('/api/applications', user.id, Date.now() - start, 201);
    return ok({ application: newRow }, 201);
  } catch (e) {
    await logRoute('/api/applications', user.id, Date.now() - start, 500);
    return serverError(e);
  }
}
