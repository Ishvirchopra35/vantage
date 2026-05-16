'use client'

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
            cursor: 'pointer',
            color: 'var(--muted)',
            background: 'none',
            border: 'none',
            fontSize: 13,
            padding: '8px 0 0 0',
            display: 'block',
          }}
        >
          {expanded ? 'Show less' : `Show more (${hiddenCount} more changes)`}
        </button>
      )}
    </div>
  )
}
