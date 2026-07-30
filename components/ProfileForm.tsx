'use client';

// Profile editor: identity, education, skills, target roles, experience,
// and projects - the inputs that feed buildUserContext for every AI call.
import { useState, useRef, useEffect } from 'react';
import { rateLimitMessage } from '@/lib/rateLimitMessage';
import { updateProfile } from '@/app/(dashboard)/actions';
import { track } from '@/lib/analytics';
import ResumeUpload from '@/components/ResumeUpload';
import CustomSelect from '@/components/CustomSelect';
import ErrorNotice from '@/components/ui/ErrorNotice';

export interface WorkExperience {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  current: boolean;
  location: string;
  bullets: string[];
}

export interface Project {
  name: string;
  description: string;
  url: string | null;
  tech_stack: string[];
  bullets: string[];
}

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
  experience?: WorkExperience[] | null;
  projects?: Project[] | null;
  cover_letter_template?: string | null;
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
  const currentYear = new Date().getFullYear();
  const graduationYears = Array.from({ length: currentYear + 7 - 1970 + 1 }, (_, i) => 1970 + i).reverse();
  const [graduationYear, setGraduationYear] = useState(initialData?.graduation_year || currentYear);
  const [yearsExperience, setYearsExperience] = useState(initialData?.years_experience || 0);
  const [linkedinUrl, setLinkedinUrl] = useState(initialData?.linkedin_url || '');
  const [portfolioUrl, setPortfolioUrl] = useState(initialData?.portfolio_url || '');
  const [githubUrl, setGithubUrl] = useState(initialData?.github_url || '');
  const [skills, setSkills] = useState<string[]>(initialData?.skills || []);
  const [targetRoles, setTargetRoles] = useState<string[]>(initialData?.target_roles || []);
  const [experience, setExperience] = useState<WorkExperience[]>(initialData?.experience || []);
  const [projects, setProjects] = useState<Project[]>(initialData?.projects || []);
  const [coverLetterTemplate, setCoverLetterTemplate] = useState(initialData?.cover_letter_template || '');
  const [projectTechInputs, setProjectTechInputs] = useState<string[]>(
    () => (initialData?.projects || []).map(() => '')
  );

  const [skillsInput, setSkillsInput] = useState('');
  const [rolesInput, setRolesInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);

  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync fields when initialData changes from a server re-render, but only
  // for fields still at their empty/default values to avoid overwriting user edits
  useEffect(() => {
    if (!initialData) return;
    setFullName(prev => prev || initialData.full_name || '');
    setPhone(prev => prev || initialData.phone || '');
    setUniversity(prev => prev || initialData.university || '');
    setGraduationYear(prev => prev === currentYear ? (initialData.graduation_year || currentYear) : prev);
    setYearsExperience(prev => prev === 0 ? (initialData.years_experience ?? 0) : prev);
    setLinkedinUrl(prev => prev || initialData.linkedin_url || '');
    setPortfolioUrl(prev => prev || initialData.portfolio_url || '');
    setGithubUrl(prev => prev || initialData.github_url || '');
    setSkills(prev => prev.length === 0 ? (initialData.skills || []) : prev);
    setTargetRoles(prev => prev.length === 0 ? (initialData.target_roles || []) : prev);
    setExperience(prev => prev.length === 0 ? (initialData.experience || []) : prev);
    setCoverLetterTemplate(prev => prev || initialData.cover_letter_template || '');
    setProjects(prev => {
      if (prev.length !== 0) return prev;
      const p = initialData.projects || [];
      setProjectTechInputs(p.map(() => ''));
      return p;
    });
  }, [initialData]);

  async function handleUploadComplete(rawText: string) {
    setError('');
    setParsing(true);
    try {
      const res = await fetch('/api/parse-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(json.error || json.message || rateLimitMessage(json.retryAfter));
          return;
        }
        setError(json.error || 'We could not read your profile from your resume.');
        return;
      }
      const { profile: p } = await res.json();
      if (p.full_name) setFullName(prev => prev || p.full_name);
      if (p.university) setUniversity(prev => prev || p.university);
      if (p.graduation_year) setGraduationYear(prev => prev === currentYear ? p.graduation_year : prev);
      if (p.years_experience != null) setYearsExperience(prev => prev === 0 ? p.years_experience : prev);
      if (p.linkedin_url) setLinkedinUrl(prev => prev || p.linkedin_url);
      if (p.skills?.length) setSkills(prev => prev.length === 0 ? p.skills : prev);
      if (p.target_roles?.length) setTargetRoles(prev => prev.length === 0 ? p.target_roles : prev);
      if (p.experience?.length) setExperience(prev => prev.length === 0 ? p.experience : prev);
      if (p.projects?.length) {
        setProjects(prev => {
          if (prev.length !== 0) return prev;
          setProjectTechInputs(p.projects.map(() => ''));
          return p.projects;
        });
      }
    } catch {
      setError('We could not read your profile because of a network error.');
    } finally {
      setParsing(false);
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
      experience: experience,
      projects: projects,
      cover_letter_template: coverLetterTemplate || null,
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
    boxShadow: 'var(--shadow-md)',
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
    border: '1px solid var(--border)',
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

  const focusStyle = '0 0 0 3px var(--focus-ring)';

  const tagWrapStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
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
    background: 'var(--gold-dim)',
    color: 'var(--gold)',
    border: '1px solid var(--gold-border)',
    borderRadius: 'var(--radius)',
    padding: '12px',
    fontSize: '14px',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '16px',
  } as const;

  return (
    <div style={{ ...cardStyle, width: '100%' }}>
      {/* Welcome banner - only on first visit */}
      {isNew && (
        <div
          style={{
            background: 'var(--card-raised)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '24px',
          }}
        >
          <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
            Welcome to Vantage. Upload your resume to get started - we&apos;ll pre-fill your profile automatically.
          </p>
        </div>
      )}

      {/* Resume - always visible so users can replace it */}
      {/* data-tour: the walkthrough points here. */}
      <div style={{ marginBottom: '24px' }} data-tour="resume-upload">
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
          Resume
        </label>
        <ResumeUpload onUploadComplete={handleUploadComplete} />
        {parsing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '10px',
              padding: '10px 14px',
              background: 'var(--gold-dim)',
              border: '1px solid var(--gold-border)',
              borderRadius: '10px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '2px solid var(--gold)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--gold)', lineHeight: 1.5 }}>
              Reading your resume and filling in your profile. This takes a few seconds, please stay on this page.
            </span>
          </div>
        )}
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
      <div className="rsp-grid-2" style={{ gap: '16px', marginBottom: '18px' }}>
        <div>
          <label style={labelStyle}>
            Graduation year
          </label>
          <CustomSelect
            value={String(graduationYear)}
            onChange={(v) => setGraduationYear(parseInt(v))}
            options={graduationYears.map((year) => ({ value: String(year), label: String(year) }))}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Years of experience
          </label>
          <CustomSelect
            value={String(yearsExperience)}
            onChange={(v) => setYearsExperience(parseInt(v))}
            options={Array.from({ length: 16 }, (_, i) => ({ value: String(i), label: i === 0 ? 'None' : String(i) }))}
          />
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
            placeholder={skills.length === 0 ? 'e.g. Project Management, Data Analysis, Public Speaking' : ''}
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
            placeholder={targetRoles.length === 0 ? 'e.g. Marketing Manager, Financial Analyst, Product Designer' : ''}
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

      {/* Experience */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <label style={labelStyle}>Experience</label>
          <button
            type="button"
            onClick={() =>
              setExperience(prev => [
                ...prev,
                { company: '', title: '', start_date: '', end_date: null, current: false, location: '', bullets: [''] },
              ])
            }
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '5px 12px',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add experience
          </button>
        </div>

        {experience.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No experience added yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {experience.map((entry, idx) => {
            const update = (patch: Partial<WorkExperience>) =>
              setExperience(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

            return (
              <div
                key={idx}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  position: 'relative',
                }}
              >
                {/* Delete entry */}
                <button
                  type="button"
                  onClick={() => setExperience(prev => prev.filter((_, i) => i !== idx))}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    padding: '0 4px',
                  }}
                  title="Remove entry"
                >
                  ×
                </button>

                {/* Title + Company */}
                <div className="rsp-grid-2" style={{ gap: '12px', marginBottom: '12px', paddingRight: '24px' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px' }}>Job title</label>
                    <input
                      type="text"
                      placeholder="Account Manager"
                      value={entry.title || ''}
                      onChange={e => update({ title: e.target.value })}
                      style={fieldStyle}
                      onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px' }}>Company</label>
                    <input
                      type="text"
                      placeholder="Acme Corp"
                      value={entry.company || ''}
                      onChange={e => update({ company: e.target.value })}
                      style={fieldStyle}
                      onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Dates + Location */}
                <div className="rsp-grid-3" style={{ gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px' }}>Start date</label>
                    <input
                      type="month"
                      value={entry.start_date || ''}
                      onChange={e => update({ start_date: e.target.value })}
                      style={{
                        ...fieldStyle,
                        borderRadius: '6px',
                        padding: '8px 12px',
                      }}
                      onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px' }}>End date</label>
                    <input
                      type="month"
                      value={entry.end_date ?? ''}
                      disabled={entry.current}
                      onChange={e => update({ end_date: e.target.value || null })}
                      style={{
                        ...fieldStyle,
                        borderRadius: '6px',
                        padding: '8px 12px',
                        opacity: entry.current ? 0.4 : 1,
                      }}
                      onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px' }}>Location</label>
                    <input
                      type="text"
                      placeholder="San Francisco, CA"
                      value={entry.location || ''}
                      onChange={e => update({ location: e.target.value })}
                      style={fieldStyle}
                      onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Current role checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <input
                    type="checkbox"
                    id={`current-${idx}`}
                    checked={entry.current}
                    onChange={e => update({ current: e.target.checked, end_date: e.target.checked ? null : entry.end_date })}
                    style={{ accentColor: 'var(--accent)', width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  <label htmlFor={`current-${idx}`} style={{ fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', margin: 0 }}>
                    Current role
                  </label>
                </div>

                {/* Bullets */}
                <div>
                  <label style={{ ...labelStyle, fontSize: '12px', marginBottom: '8px' }}>Responsibilities / bullets</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {entry.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder={`Bullet ${bIdx + 1}`}
                          value={bullet || ''}
                          onChange={e => {
                            const next = [...entry.bullets];
                            next[bIdx] = e.target.value;
                            update({ bullets: next });
                          }}
                          style={{ ...fieldStyle, flex: 1 }}
                          onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                          onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => update({ bullets: entry.bullets.filter((_, bi) => bi !== bIdx) })}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: 1,
                            padding: '0 4px',
                            flexShrink: 0,
                          }}
                          title="Remove bullet"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => update({ bullets: [...entry.bullets, ''] })}
                    style={{
                      marginTop: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '0',
                    }}
                  >
                    + Add bullet
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Projects */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <label style={labelStyle}>Projects</label>
          <button
            type="button"
            onClick={() => {
              setProjects(prev => [
                ...prev,
                { name: '', description: '', url: null, tech_stack: [], bullets: [''] },
              ]);
              setProjectTechInputs(prev => [...prev, '']);
            }}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '5px 12px',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add project
          </button>
        </div>

        {projects.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No projects added yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {projects.map((proj, idx) => {
            const update = (patch: Partial<Project>) =>
              setProjects(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

            const techInput = projectTechInputs[idx] ?? '';
            const setTechInput = (val: string) =>
              setProjectTechInputs(prev => prev.map((v, i) => (i === idx ? val : v)));

            return (
              <div
                key={idx}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  position: 'relative',
                }}
              >
                {/* Delete project */}
                <button
                  type="button"
                  onClick={() => {
                    setProjects(prev => prev.filter((_, i) => i !== idx));
                    setProjectTechInputs(prev => prev.filter((_, i) => i !== idx));
                  }}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    padding: '0 4px',
                  }}
                  title="Remove project"
                >
                  ×
                </button>

                {/* Name + URL */}
                <div className="rsp-grid-2" style={{ gap: '12px', marginBottom: '12px', paddingRight: '24px' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px' }}>Project name</label>
                    <input
                      type="text"
                      placeholder="My Project"
                      value={proj.name || ''}
                      onChange={e => update({ name: e.target.value })}
                      style={fieldStyle}
                      onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px' }}>URL <span style={{ color: 'var(--muted)' }}>(optional)</span></label>
                    <input
                      type="text"
                      placeholder="https://github.com/you/project"
                      value={proj.url ?? ''}
                      onChange={e => update({ url: e.target.value || null })}
                      style={fieldStyle}
                      onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px' }}>Description</label>
                  <input
                    type="text"
                    placeholder="One-sentence description of the project"
                    value={proj.description || ''}
                    onChange={e => update({ description: e.target.value })}
                    style={fieldStyle}
                    onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                    onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Tech stack tag input */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px' }}>Tech stack</label>
                  <div style={tagWrapStyle}>
                    {proj.tech_stack.map((tag, tIdx) => (
                      <div key={tIdx} style={chipStyle}>
                        {tag}
                        <button
                          type="button"
                          onClick={() => update({ tech_stack: proj.tech_stack.filter((_, i) => i !== tIdx) })}
                          style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', padding: '0', fontSize: '12px', lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <input
                      type="text"
                      placeholder={proj.tech_stack.length === 0 ? 'e.g. React, Python' : ''}
                      value={techInput}
                      onChange={e => setTechInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && techInput.trim()) {
                          e.preventDefault();
                          const tag = techInput.trim().replace(/,$/, '');
                          if (!proj.tech_stack.includes(tag)) {
                            update({ tech_stack: [...proj.tech_stack, tag] });
                          }
                          setTechInput('');
                        } else if (e.key === 'Backspace' && !techInput && proj.tech_stack.length > 0) {
                          update({ tech_stack: proj.tech_stack.slice(0, -1) });
                        }
                      }}
                      style={tagInputStyle}
                    />
                  </div>
                </div>

                {/* Bullets */}
                <div>
                  <label style={{ ...labelStyle, fontSize: '12px', marginBottom: '8px' }}>Key accomplishments / bullets</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {proj.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder={`Bullet ${bIdx + 1}`}
                          value={bullet || ''}
                          onChange={e => {
                            const next = [...proj.bullets];
                            next[bIdx] = e.target.value;
                            update({ bullets: next });
                          }}
                          style={{ ...fieldStyle, flex: 1 }}
                          onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
                          onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => update({ bullets: proj.bullets.filter((_, bi) => bi !== bIdx) })}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: 1,
                            padding: '0 4px',
                            flexShrink: 0,
                          }}
                          title="Remove bullet"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => update({ bullets: [...proj.bullets, ''] })}
                    style={{
                      marginTop: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '0',
                    }}
                  >
                    + Add bullet
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cover Letter Template */}
      <div style={{ marginBottom: '24px' }}>
        <label style={labelStyle}>Cover letter template <span style={{ color: 'var(--muted)' }}>(optional)</span></label>
        <p style={{ marginTop: '0', marginBottom: '8px', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
          Paste your preferred cover letter structure. Use <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: '4px', fontSize: '11px' }}>{'{company}'}</code>, <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: '4px', fontSize: '11px' }}>{'{role}'}</code>, and <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: '4px', fontSize: '11px' }}>{'{hiring_manager}'}</code> as placeholders. Vantage will fill them in automatically.
        </p>
        <textarea
          placeholder={`Dear {hiring_manager},\n\nI'm applying for the {role} position at {company}...\n\nSincerely,\n${initialData?.full_name || 'Your Name'}`}
          value={coverLetterTemplate}
          onChange={e => setCoverLetterTemplate(e.target.value)}
          rows={10}
          style={{
            ...fieldStyle,
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: 1.6,
          }}
          onFocus={e => { e.currentTarget.style.boxShadow = focusStyle; }}
          onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
        />
        {coverLetterTemplate && (
          <button
            type="button"
            onClick={() => setCoverLetterTemplate('')}
            style={{
              marginTop: '6px',
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '0',
            }}
          >
            Clear template
          </button>
        )}
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
        <ErrorNotice message={error} style={{ marginTop: '16px', borderRadius: 'var(--radius)', padding: '12px 16px' }} />
      )}
    </div>
  );
}
