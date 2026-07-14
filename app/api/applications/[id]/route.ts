// Update (status/notes) or soft-delete one tracked application.
import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, notFound, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from('applications')
      .select('id, company, role, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      await logRoute('/api/applications/[id]', user.id, Date.now() - start, 404);
      return notFound('Application');
    }

    const body = await request.json().catch(() => null);
    const validation = validateBody<{
      status?: string;
      applied_date?: string;
      notes?: string;
      company?: string;
      role?: string;
      job_url?: string;
      job_id?: string;
      resume_doc_id?: string;
      cover_letter_doc_id?: string;
      ats_score_id?: string;
    }>(body, []);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), { status: 400 });
    }

    const validBody = validation.data;
    const updates: Record<string, unknown> = {};
    if (validBody.status !== undefined) updates.status = validBody.status;
    if (validBody.applied_date !== undefined) updates.applied_date = validBody.applied_date;
    if (validBody.notes !== undefined) updates.notes = validBody.notes;
    if (validBody.company !== undefined) {
      if (!validBody.company.trim()) return new Response(JSON.stringify({ error: 'Company cannot be empty' }), { status: 400 });
      updates.company = validBody.company.trim();
    }
    if (validBody.role !== undefined) {
      if (!validBody.role.trim()) return new Response(JSON.stringify({ error: 'Role cannot be empty' }), { status: 400 });
      updates.role = validBody.role.trim();
    }
    if (validBody.job_url !== undefined) updates.job_url = validBody.job_url.trim() || null;
    // job_id lets a manual application be linked to a parsed job later
    // (enables tailoring and ATS scoring from the tracker).
    if (validBody.job_id !== undefined) updates.job_id = validBody.job_id;
    if (validBody.resume_doc_id !== undefined) updates.resume_doc_id = validBody.resume_doc_id;
    if (validBody.cover_letter_doc_id !== undefined) updates.cover_letter_doc_id = validBody.cover_letter_doc_id;
    if (validBody.ats_score_id !== undefined) updates.ats_score_id = validBody.ats_score_id;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No updatable fields were provided' }), { status: 400 });
    }

    // A linked job must exist and belong to this user.
    if (typeof updates.job_id === 'string' && updates.job_id) {
      const { data: jobRow } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', updates.job_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!jobRow) {
        await logRoute('/api/applications/[id]', user.id, Date.now() - start, 404);
        return notFound('Job');
      }
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from('applications')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(
        'id, user_id, job_id, job_title, company, role, job_url, status, applied_date, resume_doc_id, cover_letter_doc_id, ats_score_id, notes, deleted_at, created_at'
      )
      .single();

    if (updateError || !updatedRow) {
      await logRoute('/api/applications/[id]', user.id, Date.now() - start, 500);
      return serverError(new Error(updateError?.message ?? 'Failed to update application'));
    }

    if (body.status !== undefined && body.status !== existing.status) {
      void Promise.resolve(
        supabase.from('events').insert({
          user_id: user.id,
          event_name: 'updated_app_status',
          properties: {
            new_status: body.status,
            company: existing.company,
            role: existing.role,
          },
        })
      ).catch(() => {});
    }

    await logRoute('/api/applications/[id]', user.id, Date.now() - start, 200);
    return ok({ application: updatedRow });
  } catch (e) {
    await logRoute('/api/applications/[id]', user.id, Date.now() - start, 500);
    return serverError(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from('applications')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return notFound('Application');
    }

    const { error: updateError } = await supabase
      .from('applications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      return serverError(new Error(updateError.message));
    }

    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(e);
  }
}
