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
    if (validBody.resume_doc_id !== undefined) updates.resume_doc_id = validBody.resume_doc_id;
    if (validBody.cover_letter_doc_id !== undefined) updates.cover_letter_doc_id = validBody.cover_letter_doc_id;
    if (validBody.ats_score_id !== undefined) updates.ats_score_id = validBody.ats_score_id;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No updatable fields were provided' }), { status: 400 });
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
