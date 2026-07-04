import type { ComponentPropsWithoutRef } from 'react'

export const components = {
  h2: ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => (
    <h2
      style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12, color: 'var(--text)', lineHeight: 1.3 }}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: ComponentPropsWithoutRef<'h3'>) => (
    <h3
      style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8, color: 'var(--text)', lineHeight: 1.3 }}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => (
    <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 20, color: 'var(--text)' }} {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => (
    <ul style={{ paddingLeft: 24, marginBottom: 20, listStyleType: 'disc' }} {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => (
    <ol style={{ paddingLeft: 24, marginBottom: 20, listStyleType: 'decimal' }} {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => (
    <li style={{ marginBottom: 6, fontSize: 15, color: 'var(--text)' }} {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote
      style={{
        borderLeft: '3px solid var(--border)',
        paddingLeft: 16,
        color: 'var(--muted)',
        fontStyle: 'italic',
        margin: '24px 0',
      }}
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }: ComponentPropsWithoutRef<'code'>) => {
    if (className) {
      // Inside a pre block - no extra decoration
      return (
        <code style={{ fontFamily: 'monospace', fontSize: 13 }} className={className} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 13,
          fontFamily: 'monospace',
        }}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => (
    <pre
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 20,
        fontSize: 13,
        fontFamily: 'monospace',
        overflowX: 'auto',
        marginBottom: 24,
      }}
      {...props}
    >
      {children}
    </pre>
  ),
}

export default components
