// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  readOnboarding,
  shouldRunTour,
  NOT_STARTED,
  TOUR_STEPS,
  TOUR_LENGTH,
} from '@/lib/onboarding'

describe('the walkthrough itself', () => {
  // Which pages it visits is checked in tests/components/OnboardingTour.test.tsx,
  // against the sidebar. That is coverage of the app; this file covers the
  // content of the steps and the stored progress.

  it('says up front that it costs nothing', () => {
    // A brand-new user has every reason to assume a walkthrough will burn
    // their free uses, so the first step answers it before they wonder.
    expect(TOUR_STEPS[0].body.toLowerCase()).toContain('uses')
  })

  it('gives every step something to say', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim().length, step.title).toBeGreaterThan(0)
      expect(step.body.trim().length, step.title).toBeGreaterThan(20)
    }
  })
})

describe('readOnboarding', () => {
  it('treats a never-touched profile as not started', () => {
    expect(readOnboarding(null)).toEqual(NOT_STARTED)
    expect(readOnboarding(undefined)).toEqual(NOT_STARTED)
  })

  it('reads a stored position back', () => {
    expect(readOnboarding({ step: 4, completed: false, skipped: false })).toMatchObject({
      step: 4,
      completed: false,
      skipped: false,
    })
  })

  it('refuses junk rather than breaking the dashboard', () => {
    // The column is jsonb, so it can hold anything an older build wrote. A
    // malformed row must degrade to "not started", never throw - this renders
    // on the dashboard.
    for (const value of ['a string', 42, [], { step: 'four' }, { step: -3 }, { step: 1.5 }]) {
      expect(() => readOnboarding(value), JSON.stringify(value)).not.toThrow()
      expect(readOnboarding(value).step, JSON.stringify(value)).toBe(0)
    }
  })

  it('clamps a position past the end of a shortened tour', () => {
    // Removing steps must not strand someone beyond the last one with an empty
    // walkthrough and no way to finish it.
    expect(readOnboarding({ step: 999 }).step).toBe(TOUR_LENGTH - 1)
  })
})

describe('shouldRunTour', () => {
  it('runs for someone who has never seen it', () => {
    expect(shouldRunTour(NOT_STARTED)).toBe(true)
  })

  it('runs again for someone who stopped partway', () => {
    // Leaving the page is not a decision to be rid of it.
    expect(shouldRunTour({ step: 5, completed: false, skipped: false })).toBe(true)
  })

  it('never runs again once finished', () => {
    expect(shouldRunTour({ step: 13, completed: true, skipped: false })).toBe(false)
  })

  it('never runs again once skipped', () => {
    // Skipping is as final as finishing. Re-offering it is how a helpful
    // thing becomes an annoying one; Settings can replay it on request.
    expect(shouldRunTour({ step: 2, completed: false, skipped: true })).toBe(false)
  })
})

/**
 * Source with its comments removed.
 *
 * The checks below scan for calls, and a comment explaining that a call is
 * deliberately absent contains the very name being searched for - which is
 * exactly how this test failed the first time it ran. Stripping comments makes
 * it a test of the code rather than of the prose around it.
 */
function code(path: string): string {
  return readFileSync(path, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('the walkthrough costs the user nothing', () => {
  const route = code('app/api/onboarding/route.ts')

  it('never touches the limit system', () => {
    // The guarantee, pinned so it cannot be added later by habit: every other
    // route in the app calls these, and this one must not.
    for (const call of ['checkLimit', 'consumeLimit', 'recordRateLimitUse', 'checkRateLimit']) {
      expect(route, call).not.toContain(call)
    }
  })

  it('makes no AI call', () => {
    for (const call of ['generateText', 'generateJSON', 'generateChat', '@/lib/ai']) {
      expect(route, call).not.toContain(call)
    }
  })

  it('still requires a signed-in user', () => {
    // Ungated for limits is not the same as ungated for auth: it writes to a
    // profile row and must only ever write to the caller's own.
    expect(route).toContain('requireAuth')
    expect(route).toContain(".eq('id', user.id)")
  })

  it('is the only thing the tour ever calls', () => {
    const tour = code('components/OnboardingTour.tsx')
    const fetches = [...tour.matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1])
    expect(fetches).toEqual(['/api/onboarding'])
  })
})

describe('replaying the walkthrough', () => {
  // Pressing Replay in Settings reset the database and then appeared to do
  // nothing, for two reasons at once: the done flag was left set, and the layout
  // on the way to the dashboard had already rendered with the tour finished, so
  // its `run` prop still said no. Both are the same underlying fact - a Next
  // layout does not re-render on client-side navigation.
  const settings = readFileSync('components/SettingsClient.tsx', 'utf-8')
  const tour = readFileSync('components/OnboardingTour.tsx', 'utf-8')
  const lib = readFileSync('lib/onboarding.ts', 'utf-8')

  it('clears the done flag, not just the position', () => {
    expect(lib).toContain('removeItem(TOUR_DONE_KEY)')
    expect(lib).toContain('removeItem(TOUR_STEP_KEY)')
    expect(lib).toContain('removeItem(TOUR_ACTIVE_KEY)')
  })

  it('asks for the tour in a way the stale layout cannot veto', () => {
    expect(lib).toContain('setItem(TOUR_FORCE_KEY')
    expect(tour).toContain('FORCE_KEY')
  })

  it('starts a forced replay from the beginning', () => {
    // Not from the saved position: someone replaying it wants the whole thing.
    const resolver = tour.slice(
      tour.indexOf('function resolveStartingStep'),
      tour.indexOf('export default function')
    )
    expect(resolver).toContain('if (forced)')
    expect(resolver).toContain("writeSession(STEP_KEY, '0')")
    expect(resolver).toContain('return 0')
  })

  it('consumes the request, so a replay runs once and not on every page', () => {
    expect(tour).toContain('clearSession(FORCE_KEY)')
  })

  it('goes through the shared helper rather than its own magic strings', () => {
    expect(settings).toContain('requestWalkthrough()')
    // Three files have to agree about these keys, so none of them may spell
    // them out for itself.
    expect(settings).not.toContain("'vantage-tour-step'")
    expect(settings).not.toContain("'vantage-tour-done'")
  })

  it('still resets the stored progress, so the replay survives a reload', () => {
    expect(settings).toContain('/api/onboarding')
    expect(settings).toContain('completed: false')
  })
})
