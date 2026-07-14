// Manually log an outreach message written/sent outside the generator;
// stored with is_manual so it never counts as an AI generation.
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/outreach-messages'

type MessageType = 'connection_request' | 'cold_email' | 'follow_up'

// Logs a message the user wrote and sent themselves (outside the generator)
// into the outreach tracker. No AI call happens here, so there is no
// freemium/rate limit check - this is plain bookkeeping.
export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json().catch(() => null)
  const validation = validateBody<{
    contactName: string
    contactCompany: string
    messageType: MessageType
    message: string
    contactTitle?: string
    contactLinkedinUrl?: string
    sent?: boolean
  }>(body, ['contactName', 'contactCompany', 'messageType', 'message'])
  if (!validation.valid) return err(validation.error, 400)
  const { contactName, contactCompany, messageType, message, contactTitle, contactLinkedinUrl, sent } = validation.data

  const validTypes: MessageType[] = ['connection_request', 'cold_email', 'follow_up']
  if (!validTypes.includes(messageType)) return err('Invalid messageType', 400)
  if (!message.trim()) return err('Message text is required', 400)

  try {
    const supabase = await createClient()

    // Manual rows keep the user's text in user_edited_message (the field the
    // tracker prefers when rendering); generated_message stays null.
    const { data: savedRow, error: saveError } = await supabase
      .from('outreach_messages')
      .insert({
        user_id: user.id,
        contact_name: contactName.trim(),
        contact_title: contactTitle?.trim() || null,
        contact_company: contactCompany.trim(),
        contact_linkedin_url: contactLinkedinUrl?.trim() || null,
        message_type: messageType,
        generated_message: null,
        user_edited_message: message.trim(),
        is_manual: true,
        sent: sent ?? true,
        sent_at: sent === false ? null : new Date().toISOString(),
      })
      .select('id, user_id, contact_name, contact_title, contact_company, contact_linkedin_url, message_type, generated_message, user_edited_message, is_manual, sent, sent_at, job_id, created_at')
      .single()

    if (saveError || !savedRow) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return serverError(new Error(saveError?.message ?? 'Failed to log message'))
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ message: savedRow })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
