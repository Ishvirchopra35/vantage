import { redirect } from 'next/navigation';

/**
 * The contact page merged into /feedback (one form for bugs, features,
 * questions, partnerships, and press). Old links keep working.
 */
export default function ContactPage(): never {
  redirect('/feedback');
}
