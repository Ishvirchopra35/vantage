'use client';

interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export default function SkeletonLoader({
  width = '100%',
  height = '16px',
  borderRadius = 'var(--radius)',
}: SkeletonLoaderProps) {
  const widthValue = typeof width === 'number' ? `${width}px` : width;
  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const radiusValue =
    typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;

  return (
    <div
      style={{
        width: widthValue,
        height: heightValue,
        borderRadius: radiusValue,
        background:
          'linear-gradient(90deg, var(--card) 0%, var(--border) 50%, var(--card) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite',
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
