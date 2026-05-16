'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { BlogPost } from '@/lib/mdx'

const CATEGORIES = ['All', 'Product', 'Research', 'Company', 'News', 'Insights'] as const
type Category = (typeof CATEGORIES)[number]

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BlogClient({ posts }: { posts: BlogPost[] }) {
  const [activeCategory, setActiveCategory] = useState<Category>('All')

  const filtered = posts.filter(
    post => activeCategory === 'All' || post.category === activeCategory
  )

  return (
    <div>
      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              fontSize: 12,
              padding: '5px 14px',
              borderRadius: 20,
              border: activeCategory === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: activeCategory === cat ? 'var(--accent)' : 'transparent',
              color: activeCategory === cat ? 'var(--bg)' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Post list */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          No posts in this category yet.
        </div>
      ) : (
        <div>
          {filtered.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{
                display: 'block',
                padding: '14px 0',
                borderBottom: '1px solid var(--border)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                {formatDate(post.date)} · {post.category}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                {post.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {post.author} · {post.readTime}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
