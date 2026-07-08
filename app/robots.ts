import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/jobs',
          '/tailor',
          '/tracker',
          '/strategy',
          '/networking',
          '/interview',
          '/apply',
          '/profile',
          '/settings',
          '/billing',
          '/documents',
          '/ats',
          '/admin',
          '/api/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
