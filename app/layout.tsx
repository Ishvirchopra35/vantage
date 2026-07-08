import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Vantage - Your unfair advantage in job searching',
  description:
    'Vantage tailors your resume to every job with AI, scores it against ATS systems, generates cover letters, and auto-fills applications. Built for CS students and new grads.',
  applicationName: 'Vantage',
  authors: [{ name: 'Ishvir Chopra' }],
  creator: 'Ishvir Chopra',
  openGraph: {
    type: 'website',
    siteName: 'Vantage',
    title: 'Vantage - Your unfair advantage in job searching',
    description:
      'AI resume tailoring, ATS scoring, cover letters, and auto-apply for students and new grads.',
    images: [{ url: '/logo.png' }],
  },
  twitter: {
    card: 'summary',
    title: 'Vantage - Your unfair advantage in job searching',
    description:
      'AI resume tailoring, ATS scoring, cover letters, and auto-apply for students and new grads.',
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Outfit:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('vantage-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
