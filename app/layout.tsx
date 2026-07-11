import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Vantage - Your unfair advantage in job searching',
    template: '%s · Vantage',
  },
  description:
    'Vantage tailors your resume to every job with AI, scores it against ATS systems, generates cover letters, and auto-fills applications. Built for CS students and new grads.',
  applicationName: 'Vantage',
  authors: [{ name: 'Ishvir Chopra', url: 'https://ishvirschopra35.tech/' }],
  creator: 'Ishvir Chopra',
  publisher: 'Vantage',
  category: 'technology',
  keywords: [
    'Vantage',
    'AI resume tailoring',
    'ATS score checker',
    'resume keywords',
    'auto apply to jobs',
    'cover letter generator',
    'job application tracker',
    'new grad job search',
    'internship applications',
    'CS student jobs',
    'Waterloo co-op',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the token from Search
  // Console's HTML-tag verification method; the tag is omitted when unset.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
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
            __html: `(function(){try{var t=localStorage.getItem('vantage-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
