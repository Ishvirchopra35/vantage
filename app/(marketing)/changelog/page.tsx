import Link from 'next/link'
import type { ComponentPropsWithoutRef } from 'react'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getChangelog } from '@/lib/mdx'
import ChangelogExpander from '@/components/ChangelogExpander'

export const dynamic = 'force-static'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const mdxComponents = {
  h2: ({ children }: ComponentPropsWithoutRef<'h2'>) => (
    <h2
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.07em',
        color: 'var(--muted)',
        marginTop: 20,
        marginBottom: 8,
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }: ComponentPropsWithoutRef<'h3'>) => (
    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 16, marginBottom: 6 }}>
      {children}
    </h3>
  ),
  p: ({ children }: ComponentPropsWithoutRef<'p'>) => (
    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>
      {children}
    </p>
  ),
  ul: ({ children }: ComponentPropsWithoutRef<'ul'>) => (
    <ul style={{ paddingLeft: 18, marginBottom: 10 }}>{children}</ul>
  ),
  ol: ({ children }: ComponentPropsWithoutRef<'ol'>) => (
    <ol style={{ paddingLeft: 18, marginBottom: 10 }}>{children}</ol>
  ),
  li: ({ children }: ComponentPropsWithoutRef<'li'>) => (
    <li style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 3 }}>
      {children}
    </li>
  ),
}

export default async function ChangelogPage() {
  const entries = await getChangelog()

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
          <Link href="/blog" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', marginRight: 16 }}>
            Blog
          </Link>
          <Link href="/changelog" style={{ fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}>
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
        {/* Page header */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            Changelog
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
            Latest improvements, features, and fixes.
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/signup" style={{ fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}>
              Get started →
            </Link>
            <Link href="/docs" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
              Docs
            </Link>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr' }}>
          {entries.map((entry, i) => (
            <EntryRow key={i} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}

async function EntryRow({
  entry,
}: {
  entry: Awaited<ReturnType<typeof getChangelog>>[number]
}) {
  return (
    <>
      {/* Date cell */}
      <div
        style={{
          paddingRight: 24,
          paddingBottom: 48,
          paddingTop: 3,
          textAlign: 'right',
          fontSize: 11,
          color: 'var(--muted)',
          lineHeight: 1.4,
        }}
      >
        {formatDate(entry.date)}
      </div>

      {/* Content cell — border-left is the continuous vertical timeline line */}
      <div
        style={{
          paddingLeft: 28,
          paddingBottom: 48,
          borderLeft: '2px solid var(--border)',
          position: 'relative',
        }}
      >
        {/* Dot on the timeline line */}
        <div
          style={{
            position: 'absolute',
            left: -5,
            top: 6,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--border)',
          }}
        />

        {/* Type badge + version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: entry.type === 'Major Release' ? 700 : 500,
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '2px 7px',
            }}
          >
            {entry.type}
          </span>
          {entry.version && (
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
              {entry.version}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>
          {entry.title}
        </h3>

        {/* Summary */}
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
          {entry.summary}
        </p>

        {/* MDX content wrapped in expander */}
        {entry.content.trim() && (
          <ChangelogExpander preview={5}>
            <MDXRemote source={entry.content} components={mdxComponents} />
          </ChangelogExpander>
        )}
      </div>
    </>
  )
}
