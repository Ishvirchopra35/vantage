'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';

interface SpotlightProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Set when the wrapped card is decorative (mockups, examples). */
  ariaHidden?: boolean;
}

/**
 * Card wrapper that adds a cursor-following specular light. Tracks the
 * pointer and exposes it as --mx/--my CSS variables consumed by the
 * .lp-hover-light layer (and, on the closing CTA, by the metallic
 * headline). Writes styles directly on the element (no state) so
 * mousemove stays cheap. On touch devices the variables are never set
 * and the card keeps its static lighting.
 */
export default function Spotlight({ children, className = '', style, ariaHidden }: SpotlightProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>): void {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(2)}%`);
    el.style.setProperty('--my', `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(2)}%`);
    el.classList.add('is-lit');
  }

  function handleLeave(): void {
    ref.current?.classList.remove('is-lit');
  }

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      aria-hidden={ariaHidden ? 'true' : undefined}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div className="lp-hover-light" aria-hidden="true" />
      {children}
    </div>
  );
}
