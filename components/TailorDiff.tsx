'use client'

// Per-bullet diff view for tailoring results: original vs tailored lines
// with accept/reject controls.
import { useState } from 'react'

// Shared per-bullet diff view for tailored resumes. This is the only way
// tailored-resume output is ever shown to users - the full rewritten resume
// text stays internal (ATS scoring, auto-fill) and must not be rendered.

export interface TailorChange {
  section: string
  entry: string
  original: string
  tailored: string
  reason: string
}

interface EntryGroup {
  name: string
  items: { change: TailorChange; idx: number }[]
}

interface SectionGroup {
  name: string
  entries: EntryGroup[]
}

// Group changes by resume section, then by parent entry (company / project
// name), preserving the order they appear in.
export function groupTailorChanges(changes: TailorChange[]): SectionGroup[] {
  const sections: SectionGroup[] = []
  changes.forEach((change, idx) => {
    let section = sections.find(s => s.name === change.section)
    if (!section) {
      section = { name: change.section, entries: [] }
      sections.push(section)
    }
    const entryName = change.entry || ''
    let entry = section.entries.find(e => e.name === entryName)
    if (!entry) {
      entry = { name: entryName, items: [] }
      section.entries.push(entry)
    }
    entry.items.push({ change, idx })
  })
  return sections
}

// Plain-text version of just the tailored bullets, grouped by section and
// entry - what "Copy all tailored bullets" puts on the clipboard.
export function formatTailoredBullets(changes: TailorChange[]): string {
  return groupTailorChanges(changes)
    .map(section => {
      const entries = section.entries
        .map(entry => {
          const bullets = entry.items.map(({ change }) => `- ${change.tailored}`).join('\n')
          return entry.name ? `${entry.name}\n${bullets}` : bullets
        })
        .join('\n\n')
      return `${section.name.toUpperCase()}\n${entries}`
    })
    .join('\n\n')
}

export default function TailorDiff({ changes }: { changes: TailorChange[] }): React.ReactElement {
  const [copiedBullet, setCopiedBullet] = useState<number | null>(null)

  async function copyBullet(text: string, idx: number) {
    await navigator.clipboard.writeText(text)
    setCopiedBullet(idx)
    setTimeout(() => setCopiedBullet(null), 2000)
  }

  const copyBtn: React.CSSProperties = {
    background: 'var(--card-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    padding: '5px 12px',
    fontSize: '12px',
    color: 'var(--text)',
    cursor: 'pointer',
    flexShrink: 0,
  }

  return (
    <>
      {groupTailorChanges(changes).map(group => (
        <div key={group.name} style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '10px',
          }}>
            {group.name}
          </div>
          {group.entries.map(entry => (
            <div key={entry.name || '(entry)'} style={{ marginBottom: '14px' }}>
              {entry.name && (
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '8px',
                }}>
                  {entry.name}
                </div>
              )}
              {entry.items.map(({ change, idx }) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: '10px',
                    padding: '14px 8px',
                    marginBottom: '10px',
                    background: 'var(--card-raised)',
                  }}
                >
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--muted)',
                    textDecoration: 'line-through',
                    lineHeight: 1.6,
                    marginBottom: '8px',
                  }}>
                    {change.original}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      flex: 1,
                      fontSize: '13px',
                      color: 'var(--text)',
                      lineHeight: 1.6,
                      background: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                    }}>
                      {change.tailored}
                    </div>
                    <button onClick={() => void copyBullet(change.tailored, idx)} style={copyBtn}>
                      {copiedBullet === idx ? 'Copied!' : 'Copy bullet'}
                    </button>
                  </div>
                  {change.reason && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                      {change.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
