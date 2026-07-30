'use client';

// Profile section for the user's Word template.
//
// Upload once, and every resume they download comes back looking like that
// file - same fonts, same spacing, same header and footer. There is no style
// mapping UI: the server matches its slots to the template's own paragraph
// styles automatically, and an unmatched slot falls back to the template's
// normal text rather than failing.

import { useEffect, useRef, useState } from 'react';
import ErrorNotice from '@/components/ui/ErrorNotice';
import Spinner from '@/components/ui/Spinner';

interface TemplateStatus {
  hasTemplate: boolean;
  name: string | null;
  mappedSlots: number;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '24px',
  marginTop: '16px',
};

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 18px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '44px',
};

export default function ResumeTemplateUpload(): React.ReactElement {
  const [status, setStatus] = useState<TemplateStatus | null>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/resume-template')
      .then((r) => r.json())
      .then((data: TemplateStatus & { error?: string }) => {
        if (cancelled || data.error) return;
        setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not check whether you have a template saved.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(file: File) {
    if (!/\.docx$/i.test(file.name)) {
      setError('Templates must be .docx files. Re-save yours from Word if it is a .doc.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('That file is larger than 5MB.');
      return;
    }

    setBusy('upload');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/resume-template', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'We could not read that file. Try re-saving it from Word.');
        return;
      }
      setStatus(json as TemplateStatus);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('remove');
    setError('');
    try {
      const res = await fetch('/api/resume-template', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'We could not remove your template. Try again.');
        return;
      }
      setStatus(json as TemplateStatus);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
        Resume design
      </div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '6px 0 16px', lineHeight: 1.6 }}>
        Only useful if your resume is a PDF. Vantage would otherwise download it in a plain
        layout, and a Word file here gives it a design to use instead.
      </p>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
        {/* Said plainly because it is a real downgrade and easy to walk into:
            the rewrite path only applies to the resume itself. */}
        If you uploaded a Word resume above, you do not need this and it will make your downloads
        worse. Yours come back as that exact file with new wording in it. Add a design here and
        they get rebuilt in this one instead, which keeps its fonts and spacing but not your
        document.
      </p>

      {status?.hasTemplate && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            marginBottom: '12px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--score-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1, wordBreak: 'break-all' }}>
            {status.name ?? 'Your template'}
          </span>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".docx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          style={{ ...buttonStyle, opacity: busy !== null ? 0.6 : 1 }}
        >
          {busy === 'upload' ? (
            <>
              <Spinner size="sm" /> Reading...
            </>
          ) : status?.hasTemplate ? (
            'Replace template'
          ) : (
            'Upload template'
          )}
        </button>

        {status?.hasTemplate && (
          <button
            onClick={() => void remove()}
            disabled={busy !== null}
            style={{ ...buttonStyle, color: 'var(--muted)', opacity: busy !== null ? 0.6 : 1 }}
          >
            {busy === 'remove' ? (
              <>
                <Spinner size="sm" /> Removing...
              </>
            ) : (
              'Remove'
            )}
          </button>
        )}
      </div>

      {error && <ErrorNotice message={error} style={{ marginTop: '12px' }} />}
    </div>
  );
}
