'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type RevealDirection = 'up' | 'left' | 'right' | 'scale';

interface RevealProps {
  children: ReactNode;
  /** Reveal animation style. Defaults to 'up'. */
  direction?: RevealDirection;
  /** Stagger index; delay = index * stepMs. Defaults to 0 (no delay). */
  index?: number;
  /** Per-item stagger step in ms. Defaults to 75. */
  stepMs?: number;
  /** Wrapper element tag. Defaults to 'div'. */
  as?: 'div' | 'section';
  /** Extra classes to merge onto the wrapper. */
  className?: string;
  /** Inline styles forwarded to the wrapper (e.g. the section's max-width/padding). */
  style?: CSSProperties;
  /** Element id (e.g. "features") so in-page anchors keep working. */
  id?: string;
}

export default function Reveal({
  children,
  direction = 'up',
  index = 0,
  stepMs = 75,
  as = 'div',
  className = '',
  style,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || revealed) return;

    // Guard for environments without IntersectionObserver (older/SSR-mocked):
    // reveal immediately so content is never stuck hidden.
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          observer.disconnect(); // reveal-once
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [revealed]);

  const Tag = as;
  const delay = index > 0 ? { ['--reveal-delay' as string]: `${index * stepMs}ms` } : undefined;

  return (
    <Tag
      ref={ref as never}
      id={id}
      className={`reveal reveal-${direction}${revealed ? ' revealed' : ''} ${className}`.trim()}
      style={{ ...delay, ...style }}
    >
      {children}
    </Tag>
  );
}
