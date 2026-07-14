// Public feedback form handler - forwards to the spreadsheet webhook
// (FEEDBACK_SHEET_WEBHOOK_URL). No auth: visitors can report bugs too.
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { withTimeout } from '@/lib/withTimeout';

interface FeedbackBody extends Record<string, unknown> {
  type: string;
  summary: string;
  details: string;
  email?: string;
}

/**
 * Public endpoint: forwards bug reports and feature requests as one row
 * each to the spreadsheet webhook in FEEDBACK_SHEET_WEBHOOK_URL (e.g. a
 * Power Automate "When an HTTP request is received" flow that runs
 * "Add a row into a table" against an Excel workbook, or any
 * sheet-webhook service). No auth: visitors can report without an account.
 */
export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Request body must be JSON', 400);
  }

  const validation = validateBody<FeedbackBody>(body, ['type', 'summary', 'details']);
  if (!validation.valid) return err(validation.error, 400);
  const { type, summary, details, email } = validation.data;

  const TYPE_LABELS: Record<string, string> = {
    bug: 'Bug report',
    feature: 'Feature request',
    question: 'General question',
    partnership: 'Partnership',
    press: 'Press',
    other: 'Other',
  };
  if (typeof type !== 'string' || !(type in TYPE_LABELS)) {
    return err('type must be one of: bug, feature, question, partnership, press, other', 400);
  }
  if (typeof summary !== 'string' || summary.trim().length === 0 || summary.length > 200) {
    return err('summary must be 1-200 characters', 400);
  }
  if (typeof details !== 'string' || details.trim().length === 0 || details.length > 5000) {
    return err('details must be 1-5000 characters', 400);
  }
  if (email !== undefined && (typeof email !== 'string' || email.length > 320)) {
    return err('email must be a string of at most 320 characters', 400);
  }

  const webhookUrl = process.env.FEEDBACK_SHEET_WEBHOOK_URL;
  if (!webhookUrl) {
    await logRoute('feedback', null, Date.now() - start, 503);
    return err('Feedback is not set up yet. Email ishvir.chopra@gmail.com instead.', 503);
  }

  try {
    const res = await withTimeout(
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: TYPE_LABELS[type],
          summary: summary.trim(),
          details: details.trim(),
          email: email?.trim() ?? '',
          submittedAt: new Date().toISOString(),
        }),
      }),
      10000,
      'feedback'
    );

    if (!res.ok) {
      throw new Error(`Feedback sheet webhook responded with status ${res.status}`);
    }

    await logRoute('feedback', null, Date.now() - start, 200);
    return ok({ received: true });
  } catch (e) {
    await logRoute('feedback', null, Date.now() - start, 500);
    return serverError(e);
  }
}
