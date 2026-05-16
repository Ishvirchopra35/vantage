import Link from 'next/link'
import { getBlogPosts } from '@/lib/mdx'
import BlogClient from './BlogClient'

export const dynamic = 'force-static'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function BlogPage() {
  const posts = await getBlogPosts()
  const featured = posts[0] ?? null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', height: 56 }}>
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <Link href="/" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textDecoration: 'none', marginRight: 24 }}>
            Vantage
          </Link>
          <Link href="/blog" style={{ fontSize: 13, color: 'var(--text)', textDecoration: 'none', marginRight: 16 }}>
            Blog
          </Link>
          <Link href="/changelog" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
            Changelog
          </Link>
          <Link
            href="/login"
            style={{
              marginLeft: 'auto',
              fontSize: 13,
              color: 'var(--text)',
              textDecoration: 'none',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '5px 14px',
            }}
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Content */}
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
            style={{
              display: 'block',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
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
    </div>
  )
}
