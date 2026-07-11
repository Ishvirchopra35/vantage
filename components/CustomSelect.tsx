'use client';

import { useEffect, useRef, useState } from 'react';

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Extra styles for the outer wrapper (e.g. flex: 1, width) */
  style?: React.CSSProperties;
  /** Class applied to the trigger button so callers can match sibling controls. */
  triggerClassName?: string;
}

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  style,
  triggerClassName,
}: CustomSelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Clicking outside closes the dropdown
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={rootRef} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(v => !v); }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClassName}
        style={
          triggerClassName
            ? {
                // When a triggerClassName is supplied (e.g. `.filter-control`),
                // let the class own the shared metrics (height, padding, font-size,
                // border-radius, background, border). Keep only the structural
                // styles plus the right padding needed for the chevron.
                width: '100%',
                textAlign: 'left',
                color: selected ? 'var(--text)' : 'var(--muted)',
                fontFamily: 'var(--font-body)',
                paddingRight: 36,
                cursor: disabled ? 'default' : 'pointer',
                position: 'relative',
                opacity: disabled ? 0.6 : 1,
              }
            : {
                width: '100%',
                textAlign: 'left',
                background: 'var(--card-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius)',
                color: selected ? 'var(--text)' : 'var(--muted)',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                padding: '10px 36px 10px 12px',
                cursor: disabled ? 'default' : 'pointer',
                position: 'relative',
                boxSizing: 'border-box',
                opacity: disabled ? 0.6 : 1,
              }
        }
      >
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
            transition: 'transform 0.15s ease',
            display: 'inline-flex',
            color: 'var(--muted)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 50,
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--card-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            overflowX: 'hidden',
            overflowY: 'auto',
            maxHeight: 240,
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(option.value); setOpen(false); }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--card-sunken)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                style={{
                  padding: '10px 14px',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  color: isSelected ? 'var(--text)' : 'var(--muted)',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
