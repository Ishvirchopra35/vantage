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

  console.log('[stripe/checkout] env check — secretKey:', !!secretKey, 'priceId:', priceId, 'appUrl:', appUrl)

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
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    })
    console.log('[stripe/checkout] Session created, url:', session.url)
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
