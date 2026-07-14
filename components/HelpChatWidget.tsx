'use client'

// Floating help chat, mounted on every dashboard page. Answers "how do I"
// questions about Vantage via /api/app-chat; it does not generate documents.
// Conversation lives in component state only - closing the panel keeps it,
// navigating away clears it.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Spinner from '@/components/ui/Spinner'

interface ChatTurn {
  role: 'user' | 'model'
  text: string
}

const EXAMPLE_QUESTIONS = [
  'How does resume tailoring work?',
  'What does my ATS score mean?',
  'How do I set up the auto-fill extension?',
]

export default function HelpChatWidget(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Keep the newest message in view.
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [turns, pending, open])

  async function send(text: string) {
    const question = text.trim()
    if (!question || pending) return
    setError(null)
    setInput('')
    const nextTurns: ChatTurn[] = [...turns, { role: 'user', text: question }]
    setTurns(nextTurns)
    setPending(true)
    try {
      const res = await fetch('/api/app-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send at most the last 10 turns - enough context, bounded payload.
        body: JSON.stringify({ messages: nextTurns.slice(-10) }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        return
      }
      setTurns(prev => [...prev, { role: 'model', text: json.reply as string }])
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close help chat' : 'Open help chat'}
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'var(--btn-primary-bg)',
          color: 'var(--btn-primary-text)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '80px',
            width: '360px',
            maxWidth: 'calc(100vw - 48px)',
            height: '480px',
            maxHeight: 'calc(100vh - 120px)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 40,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              Vantage Help
            </div>
            <Link
              href="/feedback"
              style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}
            >
              Send feedback
            </Link>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {turns.length === 0 ? (
              <div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '14px' }}>
                  Ask anything about how Vantage works. For resume or cover letter
                  generation, use the feature pages - this chat is for questions.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {EXAMPLE_QUESTIONS.map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void send(q)}
                      style={{
                        textAlign: 'left',
                        fontSize: '12px',
                        color: 'var(--text)',
                        background: 'var(--card-raised)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {turns.map((turn, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      background: turn.role === 'user' ? 'var(--btn-primary-bg)' : 'var(--card-raised)',
                      color: turn.role === 'user' ? 'var(--btn-primary-text)' : 'var(--text)',
                    }}
                  >
                    {turn.text}
                  </div>
                ))}
                {pending && (
                  <div style={{ alignSelf: 'flex-start', padding: '8px 12px' }}>
                    <Spinner size="sm" />
                  </div>
                )}
              </div>
            )}
            {error && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#ef4444' }}>{error}</div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void send(input)}
                maxLength={2000}
                placeholder="Ask about Vantage…"
                disabled={pending}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  background: 'var(--card-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={pending || !input.trim()}
                aria-label="Send message"
                style={{
                  padding: '9px 14px',
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: pending || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: pending || !input.trim() ? 0.6 : 1,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
