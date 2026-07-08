import type { MetadataRoute } from 'next';
import { getBlogPosts } from '@/lib/mdx';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }> = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/changelog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/docs', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/docs/getting-started', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/resume-tailoring', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/ats-scoring', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/cover-letters', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/auto-fill', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/application-tracking', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/strategy-feedback', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/networking', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/interview-prep', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/billing', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/extension', priority: 0.6, changeFrequency: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let posts: Awaited<ReturnType<typeof getBlogPosts>> = [];
  try {
    posts = await getBlogPosts();
  } catch {
    // No posts directory or unreadable frontmatter - ship the static routes anyway.
  }

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: `${siteUrl}${route.path}`,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...posts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(`${post.date}T00:00:00`),
      changeFrequency: 'yearly' as const,
      priority: 0.7,
    })),
  ];
}
