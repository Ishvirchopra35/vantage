'use client';

import { useState, useRef, useEffect } from 'react';
import { updateProfile } from '@/app/(dashboard)/actions';
import { track } from '@/lib/analytics';
import ResumeUpload from '@/components/ResumeUpload';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  university: string | null;
  graduation_year: number | null;
  years_experience: number | null;
  skills: string[] | null;
  target_roles: string[] | null;
  linkedin_url: string | null;
  portfolio_url?: string | null;
  github_url?: string | null;
  updated_at: string | null;
}

interface ProfileFormProps {
  initialData: Profile | null;
  isNew?: boolean;
}

export default function ProfileForm({ initialData, isNew }: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialData?.full_name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [university, setUniversity] = useState(initialData?.university || '');
  const [graduationYear, setGraduationYear] = useState(initialData?.graduation_year || 2026);
  const [yearsExperience, setYearsExperience] = useState(initialData?.years_experience || 0);
  const [linkedinUrl, setLinkedinUrl] = useState(initialData?.linkedin_url || '');
  const [portfolioUrl, setPortfolioUrl] = useState(initialData?.portfolio_url || '');
  const [githubUrl, setGithubUrl] = useState(initialData?.github_url || '');
  const [skills, setSkills] = useState<string[]>(initialData?.skills || []);
  const [targetRoles, setTargetRoles] = useState<string[]>(initialData?.target_roles || []);

  const [skillsInput, setSkillsInput] = useState('');
  const [rolesInput, setRolesInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync fields when initialData changes from a server re-render, but only
  // for fields still at their empty/default values to avoid overwriting user edits
  useEffect(() => {
    if (!initialData) return;
    setFullName(prev => prev || initialData.full_name || '');
    setPhone(prev => prev || initialData.phone || '');
    setUniversity(prev => prev || initialData.university || '');
    setGraduationYear(prev => prev === 2026 ? (initialData.graduation_year || 2026) : prev);
    setYearsExperience(prev => prev === 0 ? (initialData.years_experience ?? 0) : prev);
    setLinkedinUrl(prev => prev || initialData.linkedin_url || '');
    setPortfolioUrl(prev => prev || initialData.portfolio_url || '');
    setGithubUrl(prev => prev || initialData.github_url || '');
    setSkills(prev => prev.length === 0 ? (initialData.skills || []) : prev);
    setTargetRoles(prev => prev.length === 0 ? (initialData.target_roles || []) : prev);
  }, [initialData]);

  async function handleUploadComplete(rawText: string) {
    try {
      const res = await fetch('/api/parse-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      if (!res.ok) return;
      const { profile: p } = await res.json();
      if (p.full_name) setFullName(prev => prev || p.full_name);
      if (p.university) setUniversity(prev => prev || p.university);
      if (p.graduation_year) setGraduationYear(prev => prev === 2026 ? p.graduation_year : prev);
      if (p.years_experience != null) setYearsExperience(prev => prev === 0 ? p.years_experience : prev);
      if (p.linkedin_url) setLinkedinUrl(prev => prev || p.linkedin_url);
      if (p.skills?.length) setSkills(prev => prev.length === 0 ? p.skills : prev);
      if (p.target_roles?.length) setTargetRoles(prev => prev.length === 0 ? p.target_roles : prev);
    } catch {
      // silent — resume upload already succeeded
    }
  }

  const handleSkillsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && skillsInput.trim()) {
      e.preventDefault();
      const newSkill = skillsInput.trim().replace(/,$/g, '');
      if (!skills.includes(newSkill)) {
        setSkills([...skills, newSkill]);
      }
      setSkillsInput('');
    } else if (e.key === 'Backspace' && !skillsInput && skills.length > 0) {
      setSkills(skills.slice(0, -1));
    }
  };

  const handleRolesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && rolesInput.trim()) {
      e.preventDefault();
      const newRole = rolesInput.trim().replace(/,$/g, '');
      if (!targetRoles.includes(newRole)) {
        setTargetRoles([...targetRoles, newRole]);
      }
      setRolesInput('');
    } else if (e.key === 'Backspace' && !rolesInput && targetRoles.length > 0) {
      setTargetRoles(targetRoles.slice(0, -1));
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const removeRole = (index: number) => {
    setTargetRoles(targetRoles.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess(false);
    setLoading(true);

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    const result = await updateProfile(initialData?.id || '', {
      full_name: fullName,
      phone: phone || null,
      university: university,
      graduation_year: graduationYear || null,
      years_experience: yearsExperience || null,
      linkedin_url: linkedinUrl,
      portfolio_url: portfolioUrl || null,
      github_url: githubUrl || null,
      skills: skills,
      target_roles: targetRoles,
    } as Partial<Profile>);

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } else {
      setError(result.error || 'Failed to save profile');
    }
  };

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const cardStyle = {
    maxWidth: 'none',
    width: '100%',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '24px',
  } as const;

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
  } as const;

  const fieldStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    boxSizing: 'border-box',
  } as const;

  const focusStyle = '0 0 0 3px rgba(255,255,255,0.08)';

  const tagWrapStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    boxSizing: 'border-box',
  } as const;

  const tagInputStyle = {
    flex: '1 1 120px',
    minWidth: '120px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '14px',
    padding: '0',
    outline: 'none',
    boxSizing: 'border-box',
  } as const;

  const chipStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'var(--border)',
    color: 'var(--text)',
    borderRadius: '6px',
    padding: '2px 8px',
    fontSize: '12px',
    lineHeight: 1.4,
  } as const;

  const buttonStyle = {
    width: '100%',
    background: 'var(--accent)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '16px',
  } as const;

  return (
    <div style={{ ...cardStyle, width: '100%' }}>
      <h1 style={{ marginBottom: '20px', color: 'var(--text)', fontSize: '24px', fontWeight: 600 }}>
        Profile
      </h1>

      {/* Welcome banner — only on first visit */}
      {isNew && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '24px',
          }}
        >
          <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
            Welcome to Vantage. Upload your resume to get started — we&apos;ll pre-fill your profile automatically.
          </p>
        </div>
      )}

      {/* Resume — always visible so users can replace it */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
          Resume
        </label>
        <ResumeUpload onUploadComplete={handleUploadComplete} />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', marginBottom: '24px' }} />

      {/* Full Name */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>
          Full name
        </label>
        <input
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={fieldStyle}
          onFocus={(e) => { e.currentTarget.style.boxShadow = focusStyle; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Phone */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>
          Phone <span style={{ color: 'var(--muted)' }}>(optional)</span>
        </label>
        <input
          type="tel"
          placeholder="+1 (555) 000-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={fieldStyle}
          onFocus={(e) => { e.currentTarget.style.boxShadow = focusStyle; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* University */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>
          University
        </label>
        <input
          type="text"
          placeholder="Stanford University"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          style={fieldStyle}
          onFocus={(e) => { e.currentTarget.style.boxShadow = focusStyle; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Graduation Year & Years Experience */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '18px' }}>
        <div>
          <label style={labelStyle}>
            Graduation year
          </label>
          <select
            value={graduationYear}
            onChange={(e) => setGraduationYear(parseInt(e.target.value))}
            style={fieldStyle}
            onFocus={(e) => { e.currentTarget.style.boxShadow = focusStyle; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {[2026, 2027, 2028, 2029, 2030, 2031, 2032].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            Years of experience
          </label>
          <select
            value={yearsExperience}
            onChange={(e) => setYearsExperience(parseInt(e.target.value))}
            style={fieldStyle}
            onFocus={(e) => { e.currentTarget.style.boxShadow = focusStyle; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'None' : i}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* LinkedIn URL */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>
          LinkedIn URL <span style={{ color: 'var(--muted)' }}>(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://linkedin.com/in/yourprofile"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          style={fieldStyle}
          onFocus={(e) => { e.currentTarget.style.boxShadow = focusStyle; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Portfolio URL */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>
          Portfolio URL <span style={{ color: 'var(--muted)' }}>(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://yourportfolio.com"
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          style={fieldStyle}
          onFocus={(e) => { e.currentTarget.style.boxShadow = focusStyle; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* GitHub URL */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>
          GitHub URL <span style={{ color: 'var(--muted)' }}>(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://github.com/yourusername"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          style={fieldStyle}
          onFocus={(e) => { e.currentTarget.style.boxShadow = focusStyle; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Skills Tags */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>
          Skills
        </label>
        <div style={tagWrapStyle}>
          {skills.map((skill, index) => (
            <div key={index} style={chipStyle}>
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(index)}
                style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', padding: '0', fontSize: '12px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
          <input
            type="text"
            placeholder={skills.length === 0 ? 'e.g. React, Python, TypeScript' : ''}
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            onKeyDown={handleSkillsKeyDown}
            style={tagInputStyle}
          />
        </div>
        <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}>
          Press Enter or comma to add a skill. Press Backspace to remove the last one.
        </p>
      </div>

      {/* Target Roles Tags */}
      <div style={{ marginBottom: '24px' }}>
        <label style={labelStyle}>
          Target roles
        </label>
        <div style={tagWrapStyle}>
          {targetRoles.map((role, index) => (
            <div key={index} style={chipStyle}>
              {role}
              <button
                type="button"
                onClick={() => removeRole(index)}
                style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', padding: '0', fontSize: '12px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
          <input
            type="text"
            placeholder={targetRoles.length === 0 ? 'e.g. Software Engineer, Product Manager' : ''}
            value={rolesInput}
            onChange={(e) => setRolesInput(e.target.value)}
            onKeyDown={handleRolesKeyDown}
            style={tagInputStyle}
          />
        </div>
        <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}>
          Press Enter or comma to add a role. Press Backspace to remove the last one.
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={buttonStyle}
      >
        {loading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--bg)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" opacity="1" />
            </svg>
            Saving...
          </span>
        ) : (
          'Save profile'
        )}
      </button>

      {success && (
        <div
          style={{
            marginTop: '16px',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(34,197,94,0.3)',
            background: 'rgba(34,197,94,0.08)',
            padding: '12px 16px',
            color: '#22c55e',
            fontSize: '13px',
          }}
        >
          Profile saved successfully
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: '16px',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.08)',
            padding: '12px 16px',
            color: '#ef4444',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
