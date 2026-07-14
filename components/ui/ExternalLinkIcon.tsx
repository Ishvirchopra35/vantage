// Small inline external-link glyph appended to outbound links.
import type { CSSProperties } from 'react';

interface ExternalLinkIconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
}

/** Square with an arrow pointing out to the top right - marks links that open another site. */
export default function ExternalLinkIcon({
  size = 13,
  className,
  style,
  'aria-hidden': ariaHidden = true,
}: ExternalLinkIconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
