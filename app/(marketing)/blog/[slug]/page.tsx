import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getBlogPost, getBlogPosts } from '@/lib/mdx'
import components from '@/components/mdx/MDXComponents'

export const dynamic = 'force-static'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatMeta(category: string, date: string, readTime: string): string {
  const d = new Date(date + 'T00:00:00')
  const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  return `${category.toUpperCase()} · ${formatted} · ${readTime.toUpperCase()}`
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const posts = await getBlogPosts()
  return posts.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const { frontmatter } = await getBlogPost(slug)
    return {
      title: `${frontmatter.title} — Vantage Blog`,
      description: frontmatter.excerpt,
    }
  } catch {
    return { title: 'Blog — Vantage' }
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let frontmatter: Awaited<ReturnType<typeof getBlogPost>>['frontmatter']
  let content: string

  try {
    const result = await getBlogPost(slug)
    frontmatter = result.frontmatter
    content = result.content
  } catch {
    notFound()
  }

  const allPosts = await getBlogPosts()
  const related = allPosts
    .filter(p => p.category === frontmatter.category && p.slug !== slug)
    .slice(0, 3)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>
        {/* Back link */}
        <Link
          href="/blog"
          style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}
        >
          ← Blog
        </Link>

        {/* Meta line */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          {formatMeta(frontmatter.category, frontmatter.date, frontmatter.readTime)}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.25,
            color: 'var(--text)',
            marginBottom: 10,
          }}
        >
          {frontmatter.title}
        </h1>

        {/* Author */}
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 40 }}>
          by {frontmatter.author}
        </p>

        {/* MDX body */}
        <div style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text)' }}>
          <MDXRemote source={content} components={components} />
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                marginBottom: 20,
              }}
            >
              More from {frontmatter.category}
            </div>
            {related.map((post, i) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{
                  display: 'block',
                  padding: '14px 0',
                  borderTop: i === 0 ? '1px solid var(--border)' : undefined,
                  borderBottom: '1px solid var(--border)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                  {formatDate(post.date)} · {post.readTime}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {post.title}
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}
