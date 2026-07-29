import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import SlowProgress, { type LoadStage } from '@/components/ui/SlowProgress'

// The whole component is a function of elapsed time, so fake timers test it
// completely - no clicking a button and hoping the server is slow today.
const STAGES: LoadStage[] = [
  { label: 'Reading your resume', seconds: 4 },
  { label: 'Rewriting your bullet points', seconds: 10 },
  { label: 'Scoring it against ATS screening', seconds: 6 },
]

/** Advances both the clock and React's view of it. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function width(): number {
  const bar = document.querySelector('.slow-progress-bar') as HTMLElement
  return parseFloat(bar.style.width)
}

describe('SlowProgress', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows nothing while a spinner is still convincing', () => {
    render(<SlowProgress active stages={STAGES} after={5000} />)
    advance(4000)
    expect(screen.queryByTestId('slow-progress')).toBeNull()
  })

  it('appears once the wait has outlasted the spinner', () => {
    render(<SlowProgress active stages={STAGES} after={5000} />)
    advance(5500)
    expect(screen.getByTestId('slow-progress')).toBeTruthy()
    expect(screen.getByText('Rewriting your bullet points')).toBeTruthy()
  })

  it('names the step the server is actually on', () => {
    render(<SlowProgress active stages={STAGES} after={1000} />)

    advance(2000) // 2s: inside the first stage (0-4s)
    expect(screen.getByText('Reading your resume')).toBeTruthy()
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()

    advance(4000) // 6s: inside the second (4-14s)
    expect(screen.getByText('Rewriting your bullet points')).toBeTruthy()
    expect(screen.getByText('Step 2 of 3')).toBeTruthy()

    advance(9000) // 15s: inside the third (14-20s)
    expect(screen.getByText('Scoring it against ATS screening')).toBeTruthy()
    expect(screen.getByText('Step 3 of 3')).toBeTruthy()
  })

  it('advances the bar as the wait goes on', () => {
    render(<SlowProgress active stages={STAGES} after={1000} />)
    advance(2000)
    const early = width()
    advance(6000)
    expect(width()).toBeGreaterThan(early)
  })

  it('never fills the bar while the request is still running', () => {
    render(<SlowProgress active stages={STAGES} after={1000} />)
    // Well past the 20s estimate. A bar that reached 100% here would be
    // claiming the work is done when it plainly is not.
    advance(60_000)
    expect(width()).toBeLessThan(100)
  })

  it('admits when it has overrun its own estimate', () => {
    render(<SlowProgress active stages={STAGES} after={1000} />)
    advance(25_000)

    expect(screen.getByText(/taking longer than usual/)).toBeTruthy()
    expect(screen.queryByText('Step 3 of 3')).toBeNull()
    // Stops advancing and pulses instead, rather than inching forward forever.
    expect(document.querySelector('.slow-progress-bar-waiting')).toBeTruthy()
  })

  it('never shows a percentage, because the number would not be measured', () => {
    render(<SlowProgress active stages={STAGES} after={1000} />)
    advance(8000)
    expect(screen.getByTestId('slow-progress').textContent).not.toMatch(/\d+\s*%/)
  })

  it('disappears the moment the request finishes', () => {
    const { rerender } = render(<SlowProgress active stages={STAGES} after={1000} />)
    advance(8000)
    expect(screen.getByTestId('slow-progress')).toBeTruthy()

    rerender(<SlowProgress active={false} stages={STAGES} after={1000} />)
    expect(screen.queryByTestId('slow-progress')).toBeNull()
  })

  it('starts from zero on the next request rather than resuming', () => {
    const { rerender } = render(<SlowProgress active stages={STAGES} after={1000} />)
    advance(8000)

    rerender(<SlowProgress active={false} stages={STAGES} after={1000} />)
    rerender(<SlowProgress active stages={STAGES} after={1000} />)

    // A second request that finishes quickly must not inherit the first one's
    // elapsed time and flash a half-full bar.
    expect(screen.queryByTestId('slow-progress')).toBeNull()
    advance(2000)
    expect(screen.getByText('Reading your resume')).toBeTruthy()
  })

  it('renders nothing when given no stages', () => {
    render(<SlowProgress active stages={[]} after={0} />)
    advance(5000)
    expect(screen.queryByTestId('slow-progress')).toBeNull()
  })
})
