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
  const [graduationYear, setGraduationYear] = useState(initialProfile?.graduation_year || 2025);
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

  const inputStyle = {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 14px',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as const;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8" style={{ color: 'var(--text)' }}>
        Profile
      </h1>

      {/* Full Name */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          Full name
        </label>
        <input
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* University */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          University
        </label>
        <input
          type="text"
          placeholder="Stanford University"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Graduation Year & Years Experience */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
            Graduation year
          </label>
          <select
            value={graduationYear}
            onChange={(e) => setGraduationYear(parseInt(e.target.value))}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
            Years of experience
          </label>
          <select
            value={yearsExperience}
            onChange={(e) => setYearsExperience(parseInt(e.target.value))}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
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
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          LinkedIn URL <span style={{ color: 'var(--muted)' }}>(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://linkedin.com/in/yourprofile"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = 'rgba(255, 255, 255, 0.12) 0px 0px 0px 3px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Skills Tags */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          Skills
        </label>
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '8px',
            backgroundColor: 'var(--bg)',
            minHeight: '44px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'flex-start',
            boxSizing: 'border-box' as const,
          }}
        >
          {skills.map((skill, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-3 py-1 rounded-full"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#000',
                fontSize: '13px',
              }}
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(index)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#000',
                  fontSize: '16px',
                  padding: '0px 2px',
                  lineHeight: '1',
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
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              fontSize: '14px',
              flex: 1,
              minWidth: '100px',
              padding: '4px 0px',
            }}
          />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '6px' }}>
          Press Enter or comma to add a skill. Press Backspace to remove the last one.
        </p>
      </div>

      {/* Target Roles Tags */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          Target roles
        </label>
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '8px',
            backgroundColor: 'var(--bg)',
            minHeight: '44px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'flex-start',
            boxSizing: 'border-box' as const,
          }}
        >
          {targetRoles.map((role, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-3 py-1 rounded-full"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#000',
                fontSize: '13px',
              }}
            >
              {role}
              <button
                type="button"
                onClick={() => removeRole(index)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#000',
                  fontSize: '16px',
                  padding: '0px 2px',
                  lineHeight: '1',
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
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              fontSize: '14px',
              flex: 1,
              minWidth: '100px',
              padding: '4px 0px',
            }}
          />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '6px' }}>
          Press Enter or comma to add a role. Press Backspace to remove the last one.
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full font-medium text-sm transition-opacity"
        style={{
          backgroundColor: 'var(--accent)',
          color: '#000',
          borderRadius: '10px',
          padding: '12px 16px',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin"
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
          className="mt-6 p-4 rounded-lg text-sm transition-opacity"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#22c55e',
            opacity: success ? 1 : 0,
          }}
        >
          Profile saved successfully
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="mt-6 p-4 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
