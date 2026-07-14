'use client';

// Shimmering placeholder block shown while data-heavy sections load.
interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export default function SkeletonLoader({
  width = '100%',
  height = '16px',
  borderRadius = 'var(--radius)',
}: SkeletonLoaderProps): React.ReactElement {
  const widthValue = typeof width === 'number' ? `${width}px` : width;
  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const radiusValue =
    typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;

  return (
    <div
      aria-hidden="true"
      style={{
        width: widthValue,
        height: heightValue,
        borderRadius: radiusValue,
        background: 'var(--card-raised)',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}
