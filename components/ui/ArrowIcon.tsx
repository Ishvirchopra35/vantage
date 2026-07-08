import type { CSSProperties } from 'react';

interface ArrowIconProps {
  direction?: 'right' | 'left';
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
}

export default function ArrowIcon({
  direction = 'right',
  className,
  style,
  'aria-hidden': ariaHidden = true,
}: ArrowIconProps) {
  return (
    <svg
      width={14}
      height={14}
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
      {direction === 'left' ? (
        <>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </>
      ) : (
        <>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </>
      )}
    </svg>
  );
}
