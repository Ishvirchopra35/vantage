// Public one-click unsubscribe - the link in every marketing email lands
// here. No login required: possession of the unguessable token is the proof.
// Always redirects to the same confirmation page so the response never
// reveals whether a token was valid.
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function unsubscribe(token: string | null): Promise<void> {
  if (!token || !UUID_RE.test(token)) return
  try {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await svc
      .from('profiles')
      .update({ marketing_emails_enabled: false })
      .eq('unsubscribe_token', token)
  } catch {
    // Swallow: the confirmation page renders either way, and the user can
    // also opt out from Settings.
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  await unsubscribe(url.searchParams.get('token'))
  return NextResponse.redirect(`${url.origin}/unsubscribed`)
}

// RFC 8058 one-click unsubscribe: mail clients POST here without opening
// a browser tab.
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url)
  await unsubscribe(url.searchParams.get('token'))
  return NextResponse.json({ ok: true })
}
