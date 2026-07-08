'use client';

import { useState } from 'react';
import Spinner from '@/components/ui/Spinner';

type FormState = 'idle' | 'loading' | 'success' | 'error';

const SUBJECTS = [
  'General question',
  'Bug report',
  'Feature request',
  'Partnership',
  'Press',
  'Other',
] as const;

type Subject = (typeof SUBJECTS)[number];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<Subject>(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    color: 'var(--muted)',
    marginBottom: '6px',
    fontWeight: 500,
  };

  async function handleSubmit() {
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Name is required.');
      setState('error');
      return;
    }

    if (!email.trim() || !isValidEmail(email)) {
      setErrorMsg('A valid email address is required.');
      setState('error');
      return;
    }

    if (!message.trim() || message.trim().length < 20) {
      setErrorMsg('Message must be at least 20 characters.');
      setState('error');
      return;
    }

    setState('loading');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }

      setState('success');
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div
        style={{
          padding: '20px 24px',
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: 'var(--radius)',
          color: '#4ade80',
          fontSize: '0.95rem',
          lineHeight: 1.6,
        }}
      >
        Message received. I&apos;ll get back to you within 48 hours.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          style={inputStyle}
          disabled={state === 'loading'}
        />
      </div>

      <div>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle}
          disabled={state === 'loading'}
        />
      </div>

      <div>
        <label style={labelStyle}>Subject</label>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value as Subject)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          disabled={state === 'loading'}
        >
          {SUBJECTS.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Message</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          rows={5}
          style={{
            ...inputStyle,
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: 1.6,
          }}
          disabled={state === 'loading'}
        />
      </div>

      <div>
        <button
          onClick={handleSubmit}
          disabled={state === 'loading'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '11px 20px',
            background: 'var(--gold-dim)',
            color: 'var(--gold)',
            border: '1px solid var(--gold-border)',
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: state === 'loading' ? 'not-allowed' : 'pointer',
            opacity: state === 'loading' ? 0.7 : 1,
          }}
        >
          {state === 'loading' ? (
            <>
              <Spinner size="sm" />
              Sending…
            </>
          ) : (
            'Send message'
          )}
        </button>

        {state === 'error' && errorMsg && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius)',
              color: '#f87171',
              fontSize: '0.88rem',
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}