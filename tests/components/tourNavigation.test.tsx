import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { TOUR_STEPS } from '@/lib/onboarding'

// Navigation between pages, which is where the walkthrough kept breaking. Both
// bugs here were invisible to a source scan and obvious the moment the
// component is actually rendered and told it is on a page.

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: { value: '/dashboard' },
  driven: [] as number[],
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname.value,
}))

// A stand-in for driver.js: it records which step it was asked to show and
// exposes the callbacks so a Next press can be simulated.
const handlers: Record<string, ((...args: unknown[]) => void) | undefined> = {}

vi.mock('driver.js', () => ({
  driver: (config: Record<string, unknown>) => {
    Object.assign(handlers, config)
    return {
      drive: (index: number) => mocks.driven.push(index),
      destroy: vi.fn(),
      refresh: vi.fn(),
    }
  },
}))

vi.mock('driver.js/dist/driver.css', () => ({}))

import OnboardingTour from '@/components/OnboardingTour'

/** Renders the tour as though the browser is on `pathname`. */
function mount(pathname: string, startAt = 0) {
  mocks.pathname.value = pathname
  return render(<OnboardingTour run startAt={startAt} includeBilling={false} />)
}

/**
 * Lets the driver setup resolve.
 *
 * Longer than it looks like it needs to be: the tour deliberately waits for the
 * page to go idle before highlighting anything, because highlighting an element
 * React has not finished hydrating makes React discard it. jsdom has no
 * requestIdleCallback, so that wait falls back to a fixed settle.
 */
async function settle(ms = 800) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

/** The tour needs its step's target on the page before it will show anything. */
function addTarget(marker: string) {
  const element = document.createElement('div')
  element.setAttribute('data-tour', marker)
  document.body.appendChild(element)
}

beforeEach(() => {
  mocks.push.mockClear()
  mocks.driven.length = 0
  sessionStorage.clear()
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
  sessionStorage.clear()
})

describe('moving to a step on another page', () => {
  it('navigates to the page the next step lives on', async () => {
    // Index 1 is the dashboard step; index 2 is on /profile.
    addTarget('page-header')
    const { rerender } = mount('/dashboard', 1)
    await settle()

    act(() => handlers.onNextClick?.())

    expect(mocks.push).toHaveBeenCalledWith('/profile')
    rerender(<></>)
  })

  it('does not navigate back to the page it just left', async () => {
    // The reported bug: Next went from step 5 to 6 and straight back to 5. The
    // index was only updated on the same-page branch, so after navigating it
    // still pointed at the previous page's step - and the effect that keeps the
    // tour on its own page pushed right back there.
    addTarget('page-header')
    const { rerender } = mount('/dashboard', 1)
    await settle()

    act(() => handlers.onNextClick?.())
    expect(mocks.push).toHaveBeenLastCalledWith('/profile')

    // The navigation completes: the same component now sees the new pathname.
    mocks.push.mockClear()
    mocks.pathname.value = '/profile'
    rerender(<OnboardingTour run startAt={1} includeBilling={false} />)
    await settle()

    const wentBack = mocks.push.mock.calls.filter(([route]) => route === '/dashboard')
    expect(wentBack, 'pushed back to the page it just left').toHaveLength(0)
  })

  it('shows the step belonging to the page it landed on', async () => {
    addTarget('page-header')
    mount('/dashboard', 1)
    await settle()

    act(() => handlers.onNextClick?.())

    mocks.driven.length = 0
    mocks.pathname.value = '/profile'
    render(<OnboardingTour run startAt={1} includeBilling={false} />)
    await settle()

    // Whatever it drove, it must be a step that belongs on /profile.
    for (const index of mocks.driven) {
      expect(TOUR_STEPS[index].route, `step ${index}`).toBe('/profile')
    }
    expect(mocks.driven.length).toBeGreaterThan(0)
  })

  it('remembers the step across the navigation', async () => {
    addTarget('page-header')
    mount('/dashboard', 1)
    await settle()

    act(() => handlers.onNextClick?.())

    // Written before navigating, so the next page picks up where this left off.
    expect(sessionStorage.getItem('vantage-tour-step')).toBe('2')
  })
})

describe('a page that refuses to load', () => {
  it('steps over it rather than pushing forever', async () => {
    vi.useFakeTimers()
    try {
      // Pretend the tour wants /profile but the browser stays on /dashboard,
      // which is what a redirect looks like from here.
      mocks.pathname.value = '/dashboard'
      render(<OnboardingTour run startAt={2} includeBilling={false} />)

      // One request to get there...
      expect(mocks.push).toHaveBeenCalledWith('/profile')
      const before = mocks.push.mock.calls.length

      // ...then it gives up, and on every other step that lives on that page
      // too - retrying the same dead route once per step would take a grace
      // period each time.
      await act(async () => {
        vi.advanceTimersByTime(3000)
      })

      const routes = mocks.push.mock.calls.slice(before).map(([route]) => route)
      expect(routes.every((route) => route !== '/profile')).toBe(true)
      expect(routes.length, 'moved on to another page').toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits out a slow navigation instead of skipping the step', async () => {
    vi.useFakeTimers()
    try {
      mocks.pathname.value = '/dashboard'
      const { rerender } = render(<OnboardingTour run startAt={2} includeBilling={false} />)
      expect(mocks.push).toHaveBeenCalledWith('/profile')

      // The navigation lands, just not instantly. Counting attempts rather than
      // timing would have skipped this step on a slow connection.
      mocks.push.mockClear()
      mocks.pathname.value = '/profile'

      // Two acts, not one: the rerender's effects have to flush - clearing the
      // give-up timer - before the clock is advanced. Doing both in one act
      // fires the timer against the old pathname.
      await act(async () => {
        rerender(<OnboardingTour run startAt={2} includeBilling={false} />)
      })
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(mocks.push).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the walkthrough never traps the user', () => {
  it('leaves them alone when they navigate somewhere themselves', async () => {
    // The reported bug: press Next on the tailor step, then try to visit any
    // other page, and the tour pushed you straight back to /tailor. It had no
    // idea whether a pathname change was its own doing or the user's.
    addTarget('page-header')
    const { rerender } = mount('/dashboard', 1)
    await settle()

    // They click a sidebar link. Nothing to do with the tour.
    mocks.push.mockClear()
    mocks.pathname.value = '/networking'
    await act(async () => {
      rerender(<OnboardingTour run startAt={1} includeBilling={false} />)
    })
    await settle()

    expect(mocks.push, 'dragged the user back').not.toHaveBeenCalled()
  })

  it('stays quiet on a page that is not its step, rather than showing the wrong thing', async () => {
    addTarget('page-header')
    mount('/dashboard', 1)
    await settle()

    mocks.driven.length = 0
    mocks.pathname.value = '/limits'
    render(<OnboardingTour run startAt={1} includeBilling={false} />)
    await settle()

    // /limits is in the tour, but not at step 1. It must not jump there.
    for (const index of mocks.driven) {
      expect(TOUR_STEPS[index].route).not.toBe('/limits')
    }
  })

  it('keeps its place, so returning to the page picks it up again', async () => {
    addTarget('page-header')
    const { rerender } = mount('/dashboard', 1)
    await settle()

    act(() => handlers.onNextClick?.())
    expect(sessionStorage.getItem('vantage-tour-step')).toBe('2')

    // Wander off...
    mocks.pathname.value = '/limits'
    await act(async () => {
      rerender(<OnboardingTour run startAt={1} includeBilling={false} />)
    })
    await settle()

    // ...the position is untouched, so /profile still has a step waiting.
    expect(sessionStorage.getItem('vantage-tour-step')).toBe('2')
  })

  it('stops navigating entirely rather than bouncing forever', async () => {
    // The backstop. Every loop so far had a different cause, so the ceiling is
    // there for the next one.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('components/OnboardingTour.tsx', 'utf-8')
    )
    expect(source).toContain('MAX_PUSHES')
  })
})
