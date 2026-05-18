'use client';

import { Fragment, type CSSProperties, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ScoreColor = 'red' | 'amber' | 'green';

type AtsScoreRow = {
  id: string;
  user_id: string;
  job_id: string | null;
  resume_id: string | null;
  document_id: string | null;
  overall_score: number | null;
  keyword_score: number | null;
  format_score: number | null;
  experience_score: number | null;
  skills_score: number | null;
  missing_keywords: string[] | null;
  scored_at: string;
  jobs: { title: string | null; company: string | null } | null;
  documents: { type: string | null; version: number | null } | null;
};

type JobRow = {
  id: string;
  title: string | null;
  company: string | null;
};

type ResumeRow = {
  id: string;
  file_name: string | null;
  is_base: boolean | null;
};

type DocumentRow = {
  id: string;
  job_id: string | null;
  type: string | null;
  version: number | null;
  created_at: string;
};

type ResumeChoice =
  | { kind: 'base'; resumeId: string; label: string }
  | { kind: 'tailored'; documentId: string; label: string };

type RunResult = {
  overall_score: number;
  keyword_score: number;
  format_score: number;
  experience_score: number;
  skills_score: number;
  missing_keywords: string[];
  present_keywords: string[];
  suggestions: string[];
};

function scoreColor(score: number | null): ScoreColor {
  if (score === null) return 'red';
  if (score >= 75) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

function scoreStyle(score: number | null): CSSProperties {
  const color = scoreColor(score);
  if (color === 'green') return { color: 'var(--score-green)' };
  if (color === 'amber') return { color: 'var(--score-amber)' };
  return { color: 'var(--score-red)' };
}

function improvementStyle(improvement: number): CSSProperties {
  if (improvement > 0) return { color: 'var(--score-green)' };
  if (improvement < 0) return { color: 'var(--score-red)' };
  return { color: 'var(--muted)' };
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));
}

function resumeTypeLabel(row: AtsScoreRow): string {
  if (row.resume_id) return 'Base Resume';
  if (row.documents?.type === 'tailored_resume') {
    return `Tailored v${row.documents.version ?? 1}`;
  }
  return 'Document';
}

function toNumber(value: number | null): string {
  if (value === null) return '—';
  return String(value);
}

export default function AtsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<AtsScoreRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [baseResume, setBaseResume] = useState<ResumeRow | null>(null);
  const [tailoredDocs, setTailoredDocs] = useState<DocumentRow[]>([]);

  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedResumeChoice, setSelectedResumeChoice] = useState('');

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('You must be logged in to view ATS scores.');
        setLoading(false);
        return;
      }

      const [scoresRes, jobsRes, baseResumeRes, docsRes] = await Promise.all([
        supabase
          .from('ats_scores')
          .select(
            'id, user_id, job_id, resume_id, document_id, overall_score, keyword_score, format_score, experience_score, skills_score, missing_keywords, scored_at, jobs(title, company), documents(type, version)'
          )
          .eq('user_id', user.id)
          .order('scored_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('id, title, company, applications!inner(id)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('resumes')
          .select('id, file_name, is_base')
          .eq('user_id', user.id)
          .eq('is_base', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('documents')
          .select('id, job_id, type, version, created_at')
          .eq('user_id', user.id)
          .eq('type', 'tailored_resume')
          .order('created_at', { ascending: false }),
      ]);

      if (scoresRes.error || jobsRes.error || docsRes.error) {
        setError(
          scoresRes.error?.message ||
            jobsRes.error?.message ||
            docsRes.error?.message ||
            'Failed to load ATS data.'
        );
        setLoading(false);
        return;
      }

      setScores((scoresRes.data ?? []) as unknown as AtsScoreRow[]);
      setJobs((jobsRes.data ?? []).map(({ id, title, company }) => ({ id, title, company })) as JobRow[]);
      setBaseResume((baseResumeRes.data ?? null) as ResumeRow | null);
      setTailoredDocs((docsRes.data ?? []) as DocumentRow[]);

      if ((jobsRes.data ?? []).length > 0) {
        setSelectedJobId((jobsRes.data ?? [])[0].id);
      }

      setLoading(false);
    }

    void load();
  }, [supabase]);

  const groupedRows = useMemo(() => {
    const byJob = new Map<string, AtsScoreRow[]>();

    for (const row of scores) {
      const key = row.job_id ?? row.id;
      const existing = byJob.get(key) ?? [];
      existing.push(row);
      byJob.set(key, existing);
    }

    return Array.from(byJob.entries())
      .map(([jobKey, rows]) => {
        rows.sort((a, b) => +new Date(b.scored_at) - +new Date(a.scored_at));

        const base = rows.find((r) => Boolean(r.resume_id));
        const tailored = rows.find((r) => !r.resume_id && r.documents?.type === 'tailored_resume');

        const improvement =
          base?.overall_score !== null &&
          base?.overall_score !== undefined &&
          tailored?.overall_score !== null &&
          tailored?.overall_score !== undefined
            ? tailored.overall_score - base.overall_score
            : null;

        const latestTs = rows.length > 0 ? +new Date(rows[0].scored_at) : 0;

        return { jobKey, latestTs, rows, improvement };
      })
      .sort((a, b) => b.latestTs - a.latestTs);
  }, [scores]);

  const resumeChoices = useMemo<ResumeChoice[]>(() => {
    const choices: ResumeChoice[] = [];

    if (baseResume?.id) {
      choices.push({
        kind: 'base',
        resumeId: baseResume.id,
        label: 'Base Resume',
      });
    }

    if (selectedJobId) {
      const jobDocs = tailoredDocs
        .filter((doc) => doc.job_id === selectedJobId)
        .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

      for (const doc of jobDocs) {
        choices.push({
          kind: 'tailored',
          documentId: doc.id,
          label: `Tailored v${doc.version ?? 1}`,
        });
      }
    }

    return choices;
  }, [baseResume, selectedJobId, tailoredDocs]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedResumeChoice('');
      return;
    }

    if (resumeChoices.length > 0) {
      const first = resumeChoices[0];
      setSelectedResumeChoice(
        first.kind === 'base' ? `base:${first.resumeId}` : `doc:${first.documentId}`
      );
    } else {
      setSelectedResumeChoice('');
    }
  }, [selectedJobId, resumeChoices]);

  const insights = useMemo(() => {
    const validOverall = scores.map((s) => s.overall_score).filter((n): n is number => n !== null);
    const validFormat = scores.map((s) => s.format_score).filter((n): n is number => n !== null);

    const avgOverall =
      validOverall.length > 0
        ? Math.round(validOverall.reduce((sum, n) => sum + n, 0) / validOverall.length)
        : null;

    const avgFormat =
      validFormat.length > 0
        ? Math.round(validFormat.reduce((sum, n) => sum + n, 0) / validFormat.length)
        : null;

    const keywordCounts = new Map<string, number>();
    for (const row of scores) {
      for (const keyword of row.missing_keywords ?? []) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
      }
    }

    const topMissingKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([keyword]) => keyword);

    const byJob = new Map<string, { base?: number; tailored?: number }>();
    for (const row of scores) {
      if (!row.job_id || row.overall_score === null) continue;
      const existing = byJob.get(row.job_id) ?? {};
      if (row.resume_id) {
        existing.base = row.overall_score;
      } else if (row.documents?.type === 'tailored_resume') {
        existing.tailored = row.overall_score;
      }
      byJob.set(row.job_id, existing);
    }

    const improvements: number[] = [];
    for (const pair of byJob.values()) {
      if (pair.base !== undefined && pair.tailored !== undefined) {
        improvements.push(pair.tailored - pair.base);
      }
    }

    const avgImprovement =
      improvements.length > 0
        ? Math.round((improvements.reduce((sum, n) => sum + n, 0) / improvements.length) * 10) / 10
        : null;

    return {
      avgOverall,
      avgFormat,
      topMissingKeywords,
      avgImprovement,
      scoreCount: scores.length,
    };
  }, [scores]);

  async function runAtsCheck() {
    if (!selectedJobId || !selectedResumeChoice) {
      setRunError('Please select a job and a resume version.');
      return;
    }

    setRunning(true);
    setRunError(null);
    setRunResult(null);

    const [kind, id] = selectedResumeChoice.split(':');
    const payload: Record<string, string> = { jobId: selectedJobId };
    if (kind === 'base') payload.resumeId = id;
    if (kind === 'doc') payload.documentId = id;

    try {
      const res = await fetch('/api/ats-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as { score?: RunResult; error?: string };
      if (!res.ok || !json.score) {
        setRunError(json.error || 'Failed to run ATS check.');
        setRunning(false);
        return;
      }

      setRunResult(json.score);

      // Refresh scores so history and insights stay current after inline run.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const scoresRes = await supabase
          .from('ats_scores')
          .select(
            'id, user_id, job_id, resume_id, document_id, overall_score, keyword_score, format_score, experience_score, skills_score, missing_keywords, scored_at, jobs(title, company), documents(type, version)'
          )
          .eq('user_id', user.id)
          .order('scored_at', { ascending: false });

        if (!scoresRes.error) {
          setScores((scoresRes.data ?? []) as unknown as AtsScoreRow[]);
        }
      }
    } catch {
      setRunError('Network error while running ATS check.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
          ATS Score History
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading scores...</div>
        ) : error ? (
          <div style={{ color: 'var(--score-red)', fontSize: '13px' }}>{error}</div>
        ) : groupedRows.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No ATS scores yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Job', 'Company', 'Resume Type', 'Overall', 'Keyword', 'Format', 'Experience', 'Skills', 'Date'].map(
                    (header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: 'left',
                          fontSize: '12px',
                          color: 'var(--muted)',
                          fontWeight: 600,
                          padding: '10px 8px',
                        }}
                      >
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <Fragment key={group.jobKey}>
                    {group.rows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px', fontSize: '13px', color: 'var(--text)' }}>
                          {row.jobs?.title ?? 'Untitled job'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', color: 'var(--muted)' }}>
                          {row.jobs?.company ?? 'Unknown'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', color: 'var(--text)' }}>
                          {resumeTypeLabel(row)}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 700, ...scoreStyle(row.overall_score) }}>
                          {toNumber(row.overall_score)}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 700, ...scoreStyle(row.keyword_score) }}>
                          {toNumber(row.keyword_score)}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 700, ...scoreStyle(row.format_score) }}>
                          {toNumber(row.format_score)}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 700, ...scoreStyle(row.experience_score) }}>
                          {toNumber(row.experience_score)}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 700, ...scoreStyle(row.skills_score) }}>
                          {toNumber(row.skills_score)}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '12px', color: 'var(--muted)' }}>
                          {formatDate(row.scored_at)}
                        </td>
                      </tr>
                    ))}

                    {group.improvement !== null && (
                      <tr key={`${group.jobKey}-improvement`}>
                        <td
                          colSpan={9}
                          style={{
                            padding: '8px 8px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            ...improvementStyle(group.improvement),
                          }}
                        >
                          Improvement: {group.improvement >= 0 ? '+' : ''}
                          {group.improvement} points
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
          Score a resume now
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--muted)' }}>
              Job
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                padding: '0 10px',
                fontSize: '13px',
              }}
            >
              {jobs.length === 0 ? (
                <option value="">No jobs available</option>
              ) : (
                jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title || 'Untitled'} {job.company ? `- ${job.company}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--muted)' }}>
              Resume Version
            </label>
            <select
              value={selectedResumeChoice}
              onChange={(e) => setSelectedResumeChoice(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                padding: '0 10px',
                fontSize: '13px',
              }}
            >
              {resumeChoices.length === 0 ? (
                <option value="">No resume versions available</option>
              ) : (
                resumeChoices.map((choice) => (
                  <option
                    key={choice.kind === 'base' ? `base:${choice.resumeId}` : `doc:${choice.documentId}`}
                    value={choice.kind === 'base' ? `base:${choice.resumeId}` : `doc:${choice.documentId}`}
                  >
                    {choice.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={runAtsCheck}
            disabled={running || !selectedJobId || !selectedResumeChoice}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--accent)',
              color: '#000',
              fontWeight: 700,
              fontSize: '13px',
              cursor: running ? 'not-allowed' : 'pointer',
              opacity: running ? 0.65 : 1,
            }}
          >
            {running ? 'Running...' : 'Run ATS check'}
          </button>
        </div>

        {runError && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--score-red)' }}>
            {runError}
          </div>
        )}

        {runResult && (
          <div
            style={{
              marginTop: '14px',
              borderTop: '1px solid var(--border)',
              paddingTop: '14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
            }}
          >
            {[
              { label: 'Overall', value: runResult.overall_score },
              { label: 'Keyword', value: runResult.keyword_score },
              { label: 'Format', value: runResult.format_score },
              { label: 'Experience', value: runResult.experience_score },
              { label: 'Skills', value: runResult.skills_score },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  background: 'var(--bg)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, ...scoreStyle(item.value) }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {insights.scoreCount >= 5 && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 24px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
            Aggregate insights
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text)' }}>
              Your average ATS score:{' '}
              <strong>
                {insights.avgOverall !== null ? `${insights.avgOverall}/100` : 'No scores yet'}
              </strong>{' '}
              <span style={{ color: 'var(--muted)' }}>(above 75 is competitive)</span>
            </div>

            <div style={{ fontSize: '14px', color: 'var(--text)' }}>
              Average improvement from tailoring:{' '}
              <strong style={{ color: insights.avgImprovement !== null && insights.avgImprovement >= 0 ? 'var(--score-green)' : 'var(--text)' }}>
                {insights.avgImprovement !== null
                  ? `${insights.avgImprovement >= 0 ? '+' : ''}${insights.avgImprovement} points`
                  : 'Not enough paired base/tailored scores yet'}
              </strong>
            </div>

            <div style={{ fontSize: '14px', color: 'var(--text)' }}>
              Most common missing keywords:{' '}
              <strong>
                {insights.topMissingKeywords.length > 0
                  ? insights.topMissingKeywords.join(', ')
                  : 'No missing keyword trends yet'}
              </strong>
            </div>

            {insights.avgFormat !== null && insights.avgFormat < 60 && (
              <div style={{ fontSize: '13px', color: 'var(--score-amber)' }}>
                Your resume may have formatting that ATS systems struggle to parse — avoid tables, columns, or graphics.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
