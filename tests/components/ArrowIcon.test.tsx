import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import ArrowIcon from '@/components/ui/ArrowIcon';

describe('ArrowIcon', () => {
  afterEach(() => {
    cleanup();
  });

  it.each([['right'], ['left']] as const)(
    'renders the %s variant with the required geometry and stroke attributes',
    (direction) => {
      const { container } = render(<ArrowIcon direction={direction} />);
      const svg = container.querySelector('svg');

      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('width', '14');
      expect(svg).toHaveAttribute('height', '14');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('stroke-width', '2');
      // Baseline alignment with surrounding text.
      expect(svg!.style.verticalAlign).toBe('middle');
      // Decorative by default - invisible to screen readers.
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('defaults to the right variant', () => {
    const explicit = render(<ArrowIcon direction="right" />);
    const explicitPoints = explicit.container.querySelector('polyline')?.getAttribute('points');
    cleanup();

    const defaulted = render(<ArrowIcon />);
    const defaultPoints = defaulted.container.querySelector('polyline')?.getAttribute('points');

    expect(defaultPoints).toBe(explicitPoints);
  });

  it('renders distinct polyline points for the right and left variants', () => {
    const right = render(<ArrowIcon direction="right" />);
    const rightPoints = right.container.querySelector('polyline')?.getAttribute('points');
    cleanup();

    const left = render(<ArrowIcon direction="left" />);
    const leftPoints = left.container.querySelector('polyline')?.getAttribute('points');

    expect(rightPoints).toBeTruthy();
    expect(leftPoints).toBeTruthy();
    expect(rightPoints).not.toBe(leftPoints);
  });
});
