// CLIENT-SIDE analytics: fire-and-forget event tracking into the events
// table. Never throws and never blocks UI - analytics must not break UX.
import { createClient as createBrowserClient } from '@/lib/supabase/client';

/** Every trackable product event. Add new names here, not ad hoc strings. */
export type EventName =
  | 'signed_up'
  | 'completed_profile'
  | 'uploaded_resume'
  | 'parsed_job'
  | 'ats_score_checked'
  | 'tailored_resume'
  | 'generated_cover_letter'
  | 'logged_application'
  | 'updated_app_status'
  | 'auto_applied'
  | 'application_question_answered'
  | 'networking_message_generated'
  | 'contact_searched'
  | 'interview_session_started'
  | 'interview_answer_assessed'
  | 'job_discovered'
  | 'viewed_strategy_feedback'
  | 'upgraded_to_pro'
  | 'cancelled_subscription';

/**
 * Track an event. Uses the browser Supabase client to obtain the current user
 * and inserts the event row. Fails silently.
 */
export async function track(eventName: EventName, properties: Record<string, unknown> = {}) {
  try {
    const supabase = createBrowserClient();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) return;

    await supabase.from('events').insert({ user_id: userId, event_name: eventName, properties });
  } catch (e) {
    // Fail silently
    return;
  }
}

export default { track };
