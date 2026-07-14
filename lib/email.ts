// SERVER-SIDE ONLY - Resend wrapper for marketing email.
// Every marketing email must carry a working unsubscribe path: both the
// one-click List-Unsubscribe headers (Gmail/Outlook surface these) and a
// visible footer link.
import { Resend } from 'resend'

let client: Resend | null = null

function getResend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    client = new Resend(key)
  }
  return client
}

export interface MarketingEmail {
  to: string
  subject: string
  html: string
  unsubscribeUrl: string
}

export interface SendResult {
  sent: boolean
  error?: string
}

/**
 * Sends one marketing email with unsubscribe headers + footer appended.
 * Returns a result instead of throwing so a batch send can tally failures
 * without aborting the loop.
 */
export async function sendMarketingEmail(email: MarketingEmail): Promise<SendResult> {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) return { sent: false, error: 'RESEND_FROM_EMAIL is not set' }

  const footer =
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />` +
    `<p style="font-size:12px;color:#6b7280;line-height:1.6">` +
    `You are receiving this because you opted in to product updates from Vantage. ` +
    `<a href="${email.unsubscribeUrl}" style="color:#6b7280">Unsubscribe</a>` +
    `</p>`

  try {
    const { error } = await getResend().emails.send({
      from,
      to: email.to,
      subject: email.subject,
      html: `${email.html}${footer}`,
      headers: {
        'List-Unsubscribe': `<${email.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    if (error) return { sent: false, error: error.message }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Unknown send error' }
  }
}
