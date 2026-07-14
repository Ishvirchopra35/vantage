// Self-serve refund: refunds the latest Pro payment when inside the 7-day
// window, cancels the subscription, and downgrades the local row.
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/requireAuth'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/stripe/refund'

// Self-serve money-back guarantee: if the latest Pro payment is within this
// window, the user can refund it themselves and drop back to the free plan.
const REFUND_WINDOW_DAYS = 7

export async function POST(): Promise<Response> {
  const start = Date.now()

  if (process.env.ENABLE_FREEMIUM !== 'true') return err('Billing is not enabled', 400)

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return err('Stripe is not configured', 500)

  try {
    const supabase = await createClient()
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!sub || sub.plan !== 'pro' || !sub.stripe_customer_id) {
      await logRoute(ROUTE, user.id, Date.now() - start, 400)
      return err('No active Pro subscription to refund', 400)
    }

    const stripe = new Stripe(secretKey)

    // Latest paid, non-zero invoice for this customer. Trial users who cancel
    // before their first charge have nothing to refund - cancelling is enough.
    const invoices = await stripe.invoices.list({
      customer: sub.stripe_customer_id,
      status: 'paid',
      limit: 10,
    })
    const paidInvoice = invoices.data.find((inv) => inv.amount_paid > 0)

    if (!paidInvoice) {
      await logRoute(ROUTE, user.id, Date.now() - start, 400)
      return err('No payment found on this subscription. If you are on a trial, just cancel - you have not been charged.', 400)
    }

    const paidAtSeconds = paidInvoice.status_transitions?.paid_at ?? paidInvoice.created
    const ageDays = (Date.now() / 1000 - paidAtSeconds) / 86400
    if (ageDays > REFUND_WINDOW_DAYS) {
      const cutoff = new Date((paidAtSeconds + REFUND_WINDOW_DAYS * 86400) * 1000)
      await logRoute(ROUTE, user.id, Date.now() - start, 400)
      return err(`The ${REFUND_WINDOW_DAYS}-day refund window for your last payment ended on ${cutoff.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`, 400)
    }

    // Refund the payment behind the invoice (charge id on classic API
    // versions, payment_intent on newer ones).
    const invoiceWithPayment = paidInvoice as Stripe.Invoice & {
      charge?: string | Stripe.Charge | null
      payment_intent?: string | Stripe.PaymentIntent | null
    }
    const chargeId = typeof invoiceWithPayment.charge === 'string' ? invoiceWithPayment.charge : invoiceWithPayment.charge?.id
    const paymentIntentId =
      typeof invoiceWithPayment.payment_intent === 'string'
        ? invoiceWithPayment.payment_intent
        : invoiceWithPayment.payment_intent?.id

    if (chargeId) {
      await stripe.refunds.create({ charge: chargeId })
    } else if (paymentIntentId) {
      await stripe.refunds.create({ payment_intent: paymentIntentId })
    } else {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return serverError(new Error('Could not locate the payment to refund'))
    }

    // End the subscription immediately - the refund means no paid period
    // remains. The webhook will also fire, but the row is updated here so the
    // UI reflects the downgrade right away.
    if (sub.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id)
      } catch {
        // Already cancelled/expired - the refund still stands.
      }
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await supabaseAdmin
      .from('subscriptions')
      .update({ plan: 'free', status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('user_id', user.id)

    void Promise.resolve(
      supabase.from('events').insert({
        user_id: user.id,
        event_name: 'subscription_refunded',
        properties: { invoice_id: paidInvoice.id, amount: paidInvoice.amount_paid },
      })
    ).catch(() => {})

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ refunded: true, message: 'Your payment has been refunded and your subscription cancelled. The money should arrive back within 5-10 business days.' })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
