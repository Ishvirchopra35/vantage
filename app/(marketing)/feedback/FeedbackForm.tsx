'use client';

import { useState, type CSSProperties } from 'react';
import Spinner from '@/components/ui/Spinner';
import CustomSelect from '@/components/CustomSelect';

const SUBJECT_OPTIONS = [
  { value: 'bug', label: 'Bug report' },
  { value: 'feature', label: 'Feature request' },
  { value: 'question', label: 'General question' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'press', label: 'Press' },
  { value: 'other', label: 'Other' },
] as const;

type SubjectValue = (typeof SUBJECT_OPTIONS)[number]['value'];

const PLACEHOLDERS: Record<SubjectValue, { summary: string; details: string }> = {
  bug: { summary: 'What broke?', details: 'What did you do, what did you expect, and what happened instead?' },
  feature: { summary: 'What should Vantage do?', details: 'Describe the feature and the problem it would solve for you.' },
  question: { summary: 'What do you want to know?', details: 'Ask away - we answer every question.' },
  partnership: { summary: 'What do you have in mind?', details: 'Tell us about your organization and the idea.' },
  press: { summary: 'What is the story?', details: 'Outlet, deadline, and what you need from us.' },
  other: { summary: 'What is this about?', details: 'Write your message.' },
};

const label: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted)',
  marginBottom: 8,
};

const field: CSSProperties = {
  width: '100%',
  background: 'var(--card-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  padding: '11px 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  color: 'var(--text)',
  outlineColor: 'var(--muted)',
};

export default function FeedbackForm(): React.ReactElement {
  const [subject, setSubject] = useState<SubjectValue>('bug');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend(): Promise<void> {
    if (sending) return;
    setError('');

    if (!summary.trim()) {
      setError('Add a short summary first.');
      return;
    }
    if (!details.trim()) {
      setError('Add some details so we can act on it.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: subject,
          summary: summary.trim(),
          details: details.trim(),
          email: email.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'We could not send your message. Try again in a moment.');
        return;
      }

      setSent(true);
      setSummary('');
      setDetails('');
      setEmail('');
    } catch {
      setError('We could not send your message. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="ds-card" style={{ padding: 28, textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            margin: '0 auto 14px',
            borderRadius: 999,
            background: 'rgba(34, 197, 94, 0.12)',
            color: 'var(--score-green)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="2 8 6 12 14 3" />
          </svg>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          Message sent. Thank you.
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>
          The team reads every submission.
        </p>
        <button
          type="button"
          className="ds-btn"
          onClick={() => setSent(false)}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="ds-card" style={{ padding: 28 }}>
      {/* Subject */}
      <label style={label} id="feedback-subject-label">Subject</label>
      <CustomSelect
        value={subject}
        options={[...SUBJECT_OPTIONS]}
        onChange={(value) => setSubject(value as SubjectValue)}
        style={{ marginBottom: 22, maxWidth: 320 }}
      />

      {/* Summary */}
      <label style={label} htmlFor="feedback-summary">Summary</label>
      <input
        id="feedback-summary"
        type="text"
        value={summary}
        maxLength={200}
        onChange={(e) => setSummary(e.target.value)}
        placeholder={PLACEHOLDERS[subject].summary}
        style={{ ...field, marginBottom: 22 }}
      />

      {/* Details */}
      <label style={label} htmlFor="feedback-details">Details</label>
      <textarea
        id="feedback-details"
        value={details}
        maxLength={5000}
        onChange={(e) => setDetails(e.target.value)}
        placeholder={PLACEHOLDERS[subject].details}
        rows={6}
        style={{ ...field, resize: 'vertical', marginBottom: 22 }}
      />

      {/* Email */}
      <label style={label} htmlFor="feedback-email">Email (optional, so we can follow up)</label>
      <input
        id="feedback-email"
        type="email"
        value={email}
        maxLength={320}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@school.edu"
        style={{ ...field, marginBottom: 26 }}
      />

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--score-red)', margin: '0 0 16px' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="ds-btn-primary"
        onClick={handleSend}
        disabled={sending}
        style={{ minWidth: 150 }}
      >
        {sending ? <Spinner size="sm" /> : 'Send message'}
      </button>
    </div>
  );
}
