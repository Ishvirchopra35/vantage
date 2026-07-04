'use client';

import { useState } from 'react';

interface ExtensionTokenSectionProps {
  initialToken: string | null;
  initialTokenCreatedAt: string | null;
}

export default function ExtensionTokenSection({
  initialToken,
  initialTokenCreatedAt,
}: ExtensionTokenSectionProps) {
  const [token, setToken] = useState(initialToken);
  const [createdAt, setCreatedAt] = useState(initialTokenCreatedAt);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setNewToken(null);

    try {
      const res = await fetch('/api/extension/token', { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error ?? 'Failed to generate token');
        return;
      }
      const json = await res.json() as { token: string };
      setToken(json.token);
      setNewToken(json.token);
      setCreatedAt(new Date().toISOString());
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy - please copy manually.');
    }
  }

  const cardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '24px',
    marginTop: '16px',
  } as const;

  const fieldStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: '13px',
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box',
  } as const;

  const maskedToken = token
    ? token.slice(0, 8) + '••••••••••••••••••••' + token.slice(-4)
    : null;

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
          Browser Extension
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
          Generate a token to connect the Vantage Chrome Extension. The extension uses this token to fill job application forms with your profile.
        </p>
      </div>

      {newToken ? (
        <div
          style={{
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '16px',
          }}
        >
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#22c55e', marginBottom: '8px' }}>
            Token generated. Copy it now
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={newToken}
              style={{ ...fieldStyle, flex: 1, color: '#22c55e' }}
            />
            <button
              onClick={() => handleCopy(newToken)}
              style={{
                padding: '8px 14px',
                background: '#22c55e',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
            Paste this into the Vantage extension popup. It will not be shown again.
          </p>
        </div>
      ) : token ? (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
            Active token{formattedDate ? ` · Generated ${formattedDate}` : ''}
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '12px',
                color: 'var(--muted)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {maskedToken}
            </div>
            <button
              onClick={() => handleCopy(token)}
              style={{
                padding: '8px 14px',
                background: 'var(--card)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <div
          style={{
            fontSize: '12px',
            color: '#ef4444',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '12px',
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: '10px 18px',
          background: token ? 'var(--card)' : 'var(--accent)',
          color: token ? 'var(--text)' : 'var(--bg)',
          border: token ? '1px solid var(--border)' : 'none',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Generating...' : token ? 'Regenerate token' : 'Generate token'}
      </button>

      {token && !newToken && (
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
          Regenerating will invalidate the current token. Update the extension with the new one.
        </p>
      )}
    </div>
  );
}
