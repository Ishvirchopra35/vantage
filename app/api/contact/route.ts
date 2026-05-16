import { createClient as createServiceClient } from '@supabase/supabase-js';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type ContactBody = {
  name: string;
  email: string;
  message: string;
  subject?: string;
};

export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as unknown;

  const validation = validateBody<ContactBody>(body, ['name', 'email', 'message']);
  if (!validation.valid) return err(validation.error, 400);

  const { name, email, message, subject } = validation.data;

  if (!isValidEmail(email)) return err('Invalid email address.', 400);
  if (message.trim().length < 20) return err('Message must be at least 20 characters.', 400);

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Rate limit: one submission per email per hour
  const { count } = await supabase
    .from('contact_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.trim().toLowerCase())
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if ((count ?? 0) > 0) {
    return err('Please wait before sending another message.', 429);
  }

  try {
    const { error } = await supabase
      .from('contact_submissions')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject ?? null,
        message: message.trim(),
      });

    if (error) throw error;

    return ok({ message: 'Message sent.' });
  } catch (e) {
    return serverError(e);
  }
}
