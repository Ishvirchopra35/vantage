'use client';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizePixels = sizeMap[size];

  return (
    <div
      style={{
        width: `${sizePixels}px`,
        height: `${sizePixels}px`,
        borderWidth: Math.ceil(sizePixels / 8),
        borderStyle: 'solid',
        borderColor: `var(--accent)`,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
      className={className}
    >
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
