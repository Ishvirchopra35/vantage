import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { debugSlow, debugSlowMs } from '@/lib/debugSlow'

// The switch that makes a fast request behave like a slow one, so the long-wait
// UI can be seen on demand instead of by clicking buttons and hoping.
describe('debugSlow', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('is off unless the flag is set', () => {
    expect(debugSlowMs()).toBe(0)
  })

  it('returns the configured delay', () => {
    localStorage.setItem('vantage-slow', '25000')
    expect(debugSlowMs()).toBe(25000)
  })

  it('caps the delay, so one extra zero does not wedge the page', () => {
    localStorage.setItem('vantage-slow', '3600000')
    expect(debugSlowMs()).toBe(120_000)
  })

  it('ignores junk rather than throwing inside a request handler', () => {
    for (const value of ['', 'soon', '-5', 'NaN']) {
      localStorage.setItem('vantage-slow', value)
      expect(debugSlowMs(), value).toBe(0)
    }
  })

  it('resolves immediately when off, so it costs nothing in normal use', async () => {
    vi.useFakeTimers()
    let done = false
    void debugSlow().then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('waits the configured time when on', async () => {
    localStorage.setItem('vantage-slow', '5000')
    vi.useFakeTimers()

    let done = false
    void debugSlow().then(() => {
      done = true
    })

    await vi.advanceTimersByTimeAsync(4000)
    expect(done).toBe(false)

    await vi.advanceTimersByTimeAsync(1500)
    expect(done).toBe(true)
  })
})
