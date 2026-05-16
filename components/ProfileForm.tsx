'use client';

import { useState, useRef, useEffect } from 'react';
import { updateProfile } from '@/app/(dashboard)/actions';
import { track } from '@/lib/analytics';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  university: string | null;
  graduation_year: number | null;
  years_experience: number | null;
  skills: string[] | null;
  target_roles: string[] | null;
  linkedin_url: string | null;
  updated_at: string | null;
}

interface ProfileFormProps {
  initialProfile: Profile | null;
}

export default function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialProfile?.full_name || '');
  const [university, setUniversity] = useState(initialProfile?.university || '');
  const [graduationYear, setGraduationYear] = useState(initialProfile?.graduation_year || 2026);
  const [yearsExperience, setYearsExperience] = useState(initialProfile?.years_experience || 0);
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile?.linkedin_url || '');
  const [skills, setSkills] = useState<string[]>(initialProfile?.skills || []);
  const [targetRoles, setTargetRoles] = useState<string[]>(initialProfile?.target_roles || []);

  const [skillsInput, setSkillsInput] = useState('');
  const [rolesInput, setRolesInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle tag input for skills
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

  // Handle tag input for roles
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

    const result = await updateProfile(initialProfile?.id || '', {
      full_name: fullName,
      university: university,
      graduation_year: graduationYear || null,
      years_experience: yearsExperience || null,
      linkedin_url: linkedinUrl,
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
      <h1 style={{ marginBottom: '24px', color: 'var(--text)', fontSize: '24px', fontWeight: 600 }}>
        Profile
      </h1>

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
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = focusStyle;
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
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
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = focusStyle;
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
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
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = focusStyle;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
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
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = focusStyle;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
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
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = focusStyle;
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Skills Tags */}
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>
          Skills
        </label>
        <div style={tagWrapStyle}>
          {skills.map((skill, index) => (
            <div
              key={index}
              style={chipStyle}
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(index)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  padding: '0',
                  fontSize: '12px',
                  lineHeight: 1,
                }}
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
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
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
            <div
              key={index}
              style={chipStyle}
            >
              {role}
              <button
                type="button"
                onClick={() => removeRole(index)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  padding: '0',
                  fontSize: '12px',
                  lineHeight: 1,
                }}
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
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" opacity="1" />
            </svg>
            Saving...
          </span>
        ) : (
          'Save profile'
        )}
      </button>

      {/* Success Message */}
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

      {/* Error Message */}
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
