import { Children, Fragment, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getChangelog } from '@/lib/mdx'
import ChangelogExpander from '@/components/ChangelogExpander'
import ArrowIcon from '@/components/ui/ArrowIcon'

export const dynamic = 'force-static'

export const metadata = {
  title: 'Changelog',
  description: 'Every feature, fix, and improvement shipped to Vantage - updated continuously.',
  alternates: { canonical: '/changelog' },
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Escapes MDX-significant characters in changelog body prose so that literal
 * `{`, `}`, and `<` (e.g. `{ fields: [...] }` or `counts <a tags`) render as
 * text instead of being compiled as JSX expressions/elements — which otherwise
 * aborts the static build with an acorn parse error. Inline code spans and
 * fenced code blocks are left untouched, since MDX already treats their
 * contents literally. Applied only at render time; the parsed `content` field
 * itself is stored verbatim.
 */
function escapeMdxProse(source: string): string {
  // Split into segments, isolating fenced code blocks and inline code spans so
  // they pass through unescaped; escape everything else.
  const parts = source.split(/(```[\s\S]*?```|`[^`]*`)/g)
  return parts
    .map((part, index) => {
      // Odd indices are the captured code segments — leave them verbatim.
      if (index % 2 === 1) return part
      return part.replace(/[{}<]/g, (char) => `\\${char}`)
    })
    .join('')
}

/**
 * Walks rendered MDX children and replaces literal arrow characters in string
 * nodes with inline <ArrowIcon /> elements. `→` becomes a right-pointing icon
 * and `←` a left-pointing one; text segments are preserved and interleaved.
 * Non-string children (e.g. inline <code>) pass through unchanged, so arrows
 * inside code stay literal - that's deliberate. The icon's `verticalAlign`
 * keeps in-sentence arrows baseline-aligned.
 */
function renderArrows(children: ReactNode): ReactNode {
  return Children.map(children, (child, childIndex) => {
    if (typeof child !== 'string') return child

    const segments = child.split(/([→←])/).filter((segment) => segment !== '')
    if (segments.length === 1 && segments[0] !== '→' && segments[0] !== '←') {
      return child
    }

    return segments.map((segment, segmentIndex) => {
      const key = `${childIndex}-${segmentIndex}`
      if (segment === '→') return <ArrowIcon key={key} />
      if (segment === '←') return <ArrowIcon key={key} direction="left" />
      return <Fragment key={key}>{segment}</Fragment>
    })
  })
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
      {renderArrows(children)}
    </h3>
  ),
  p: ({ children }: ComponentPropsWithoutRef<'p'>) => (
    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>
      {renderArrows(children)}
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
      {renderArrows(children)}
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
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '48px 24px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 6 }}>
          <span className="lph-metal">Changelog</span>
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
          Latest improvements, features, and fixes.
        </p>
      </div>

      {/* Jump list: anchors to every update */}
      <details className="cl-jump">
        <summary className="cl-jump-summary">Jump to an update</summary>
        <div className="cl-jump-list">
          {entries.map((entry, i) => (
            <a key={i} href={`#update-${i}`} className="cl-jump-link">
              <span className="cl-jump-date">{formatDate(entry.date)}</span>
              <span className="cl-jump-title">{entry.title}</span>
            </a>
          ))}
        </div>
      </details>

      {/* Timeline: date rail left, entries on a continuous line */}
      <div className="cl-timeline">
        {entries.map((entry, i) => (
          <TimelineEntry key={i} entry={entry} anchorId={`update-${i}`} />
        ))}
      </div>
    </div>
  )
}

async function TimelineEntry({
  entry,
  anchorId,
}: {
  entry: Awaited<ReturnType<typeof getChangelog>>[number]
  anchorId: string
}) {
  return (
    <div className="cl-entry" id={anchorId}>
      <span className="cl-node" aria-hidden="true" />
      <div className="cl-meta">
        <div className="cl-date">{formatDate(entry.date)}</div>
        <span className="cl-type">{entry.type}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <h2 className="cl-title">{entry.title}</h2>
        <p className="cl-summary">{entry.summary}</p>
        {entry.content.trim() && (
          <ChangelogExpander preview={5}>
            <MDXRemote source={escapeMdxProse(entry.content)} components={mdxComponents} />
          </ChangelogExpander>
        )}
      </div>
    </div>
  )
}
