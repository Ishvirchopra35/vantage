'use client'

// Expand/collapse wrapper for long changelog entries on /changelog.
import { useState, useEffect, useRef } from 'react'

interface Props {
  children: React.ReactNode
  preview?: number
}

export default function ChangelogExpander({ children, preview = 5 }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [hiddenCount, setHiddenCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const items = Array.from(el.querySelectorAll('li'))
    const hidden = Math.max(0, items.length - preview)
    setHiddenCount(hidden)
    items.forEach((item, i) => {
      ;(item as HTMLElement).style.display = !expanded && i >= preview ? 'none' : ''
    })
  }, [expanded, preview])

  return (
    <div>
      <div ref={ref}>{children}</div>
      {(hiddenCount > 0 || expanded) && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: 0,
            marginTop: 12,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
        >
          {expanded ? 'Show less' : `Show more (${hiddenCount} more changes)`}
        </button>
      )}
    </div>
  )
}
