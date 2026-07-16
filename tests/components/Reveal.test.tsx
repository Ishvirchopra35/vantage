import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import Reveal from '@/components/marketing/Reveal';

/**
 * jsdom has no IntersectionObserver. This controllable mock captures the
 * constructor callback so tests can fire it on demand, and exposes
 * observe/disconnect spies to assert reveal-once behavior.
 */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];

  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  get observedEl(): Element | undefined {
    return this.observe.mock.calls.at(-1)?.[0] as Element | undefined;
  }

  fire(isIntersecting: boolean) {
    const entry = {
      isIntersecting,
      target: this.observedEl as Element,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: 0,
    } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
}

function installMock() {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
}

function latestObserver(): MockIntersectionObserver {
  const obs = MockIntersectionObserver.instances.at(-1);
  if (!obs) throw new Error('No IntersectionObserver was created');
  return obs;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Reveal', () => {
  it('renders initially hidden with "reveal reveal-up" and without "revealed"', () => {
    installMock();
    const { container } = render(<Reveal>content</Reveal>);
    const wrapper = container.firstElementChild as HTMLElement;

    expect(wrapper.className).toContain('reveal reveal-up');
    expect(wrapper.className).not.toContain('revealed');
  });

  it('adds "revealed" and disconnects the observer when it intersects (reveal-once)', () => {
    installMock();
    const { container } = render(<Reveal>content</Reveal>);
    const wrapper = container.firstElementChild as HTMLElement;
    const observer = latestObserver();

    act(() => {
      observer.fire(true);
    });

    expect(wrapper.className).toContain('revealed');
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('stays revealed when a later callback reports isIntersecting: false', () => {
    installMock();
    const { container } = render(<Reveal>content</Reveal>);
    const wrapper = container.firstElementChild as HTMLElement;
    const observer = latestObserver();

    act(() => {
      observer.fire(true);
    });
    act(() => {
      observer.fire(false);
    });

    expect(wrapper.className).toContain('revealed');
  });

  it('sets --reveal-delay from index * stepMs, and none when index is 0', () => {
    installMock();

    const staggered = render(<Reveal index={2} stepMs={75}>content</Reveal>);
    const staggeredWrapper = staggered.container.firstElementChild as HTMLElement;
    expect(staggeredWrapper.style.getPropertyValue('--reveal-delay')).toBe('150ms');

    cleanup();

    const noDelay = render(<Reveal index={0} stepMs={75}>content</Reveal>);
    const noDelayWrapper = noDelay.container.firstElementChild as HTMLElement;
    expect(noDelayWrapper.style.getPropertyValue('--reveal-delay')).toBe('');
  });

  it('reveals immediately when IntersectionObserver is unavailable (SSR/old-browser guard)', () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    let container: HTMLElement;
    act(() => {
      container = render(<Reveal>content</Reveal>).container;
    });
    const wrapper = container!.firstElementChild as HTMLElement;

    expect(wrapper.className).toContain('revealed');
  });
});
