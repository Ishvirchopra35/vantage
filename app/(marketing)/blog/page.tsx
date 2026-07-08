import { getBlogPosts } from '@/lib/mdx'
import BlogClient from './BlogClient'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata = {
  title: 'Blog',
  description:
    'Job search strategy for students and new grads - resume tailoring, ATS systems, recruiting season tactics, and what actually gets interviews.',
  alternates: { canonical: '/blog' },
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function BlogPage() {
  const posts = await getBlogPosts()
  const featured = posts[0] ?? null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
        {/* Heading */}
        <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Blog</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 32 }}>
          Insights on job searching, AI, and career development.
        </p>

        {/* Featured card */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="ds-card"
            style={{
              display: 'block',
              padding: 28,
              marginBottom: 32,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                marginBottom: 10,
              }}
            >
              {featured.category}
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 8,
                lineHeight: 1.3,
              }}
            >
              {featured.title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
              {featured.excerpt}
            </p>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {featured.author} · {formatDate(featured.date)} · {featured.readTime}
            </div>
          </Link>
        )}

        {/* Category tabs + post list */}
        <BlogClient posts={posts} />
    </div>
  )
}
