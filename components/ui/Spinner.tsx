'use client';

// CSS-only loading spinner (sm/md/lg). Used inside every async button.
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
        // currentColor, not var(--accent). The accent is the page's text
        // colour, which in light mode is near-black - and most spinners sit
        // inside the primary button, which is dark-filled with white text in
        // both themes. So in light mode the spinner was drawn near-black on a
        // near-black button and simply did not appear. Inheriting the colour
        // of whatever it sits in is right everywhere: white on the dark
        // button, dark on a light page.
        borderColor: 'currentColor',
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
      role="status"
      aria-label="Loading"
      className={className}
    />
  );
}
