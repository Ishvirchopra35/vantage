// Creates a Stripe Checkout session for the Pro subscription, tagging it
// with the Supabase user id so the webhook can map it back.
import { requireAuth } from '@/lib/requireAuth'
import { ok, err } from '@/lib/apiResponse'
import Stripe from 'stripe'

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const secretKey = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_PRO_PRICE_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL


  if (!secretKey || !priceId || !appUrl) {
    console.error('[stripe/checkout] Missing env vars')
    return err('Stripe env vars not configured', 500)
  }

  let session: Stripe.Checkout.Session
  try {
    const stripe = new Stripe(secretKey)
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/billing`,
      customer_email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
        // 7-day free trial: the card is collected up front, billing starts
        // when the trial ends, and it is cancellable any time via the portal.
        trial_period_days: 7,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[stripe/checkout] Session creation failed:', msg)
    return err(msg, 500)
  }

  if (!session.url) {
    console.error('[stripe/checkout] Session created but url is null')
    return err('Checkout session URL is null', 500)
  }

  return ok({ url: session.url })
}
