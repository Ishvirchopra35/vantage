import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Contact',
  description: 'Get in touch with the Vantage team',
};

/**
 * The contact page merged into /feedback (one form for bugs, features,
 * questions, partnerships, and press). Old links keep working.
 */
export default function ContactPage(): never {
  redirect('/feedback');
}
