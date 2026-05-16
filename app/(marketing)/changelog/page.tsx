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
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        color: 'var(--muted)',
        marginTop: 20,
        marginBottom: 10,
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
    <ul style={{ listStyle: 'none', paddingLeft: 0, marginBottom: 10 }}>{children}</ul>
  ),
  ol: ({ children }: ComponentPropsWithoutRef<'ol'>) => (
    <ol style={{ listStyle: 'none', paddingLeft: 0, marginBottom: 10 }}>{children}</ol>
  ),
  li: ({ children }: ComponentPropsWithoutRef<'li'>) => (
    <li style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, color: 'var(--muted)' }}>•</span>
      {children}
    </li>
  ),
  code: ({ children }: ComponentPropsWithoutRef<'code'>) => (
    <code
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 12,
        fontFamily: 'monospace',
        color: 'var(--text)',
      }}
    >
      {children}
    </code>
  ),
}

export default async function ChangelogPage() {
  const entries = await getChangelog()

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          Changelog
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 32 }}>
          Latest improvements, features, and fixes.
        </p>
      </div>

      {/* Changelog entries as cards */}
      <div>
        {entries.map((entry, i) => (
          <EntryCard key={i} entry={entry} />
        ))}
      </div>
    </div>
  )
}

async function EntryCard({
  entry,
}: {
  entry: Awaited<ReturnType<typeof getChangelog>>[number]
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 32,
        marginBottom: 16,
      }}
    >
      {/* Header row: Type badge + Date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 20,
          }}
        >
          {entry.type}
        </span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {formatDate(entry.date)}
        </span>
      </div>

      {/* Title */}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
        {entry.title}
      </h2>

      {/* Description/Summary */}
      <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
        {entry.summary}
      </p>

      {/* MDX content wrapped in expander */}
      {entry.content.trim() && (
        <ChangelogExpander preview={5}>
          <MDXRemote source={entry.content} components={mdxComponents} />
        </ChangelogExpander>
      )}
    </div>
  )
}
