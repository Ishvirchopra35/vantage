import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TOUR_STEPS, TOUR_LENGTH, tourRoutes, stepsFor } from '@/lib/onboarding'

/** Every component and page in the app, so anchors are found wherever they are. */
function sourceFiles(dir = '.', found: string[] = []): string[] {
  for (const root of dir === '.' ? ['app', 'components'] : [dir]) {
    for (const entry of readdirSync(root)) {
      const path = join(root, entry)
      if (statSync(path).isDirectory()) sourceFiles(path, found)
      else if (/\.tsx$/.test(entry)) found.push(path)
    }
  }
  return found
}

/** Every `data-tour` value the app renders anywhere. */
function renderedAnchors(): Set<string> {
  const anchors = new Set<string>()
  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf-8')
    for (const match of source.matchAll(/data-tour="([^"]+)"/g)) anchors.add(match[1])
    // The sidebar sets its anchor from each link's own href.
    if (source.includes('data-tour={item.href}')) {
      for (const nav of source.matchAll(/\{ href: '([^']+)', label:/g)) anchors.add(nav[1])
    }
  }
  return anchors
}

/** The `data-tour` values a step's selector depends on, including alternatives. */
function anchorsIn(selector: string): string[] {
  return [...selector.matchAll(/\[data-tour="([^"]+)"\]/g)].map((m) => m[1])
}

// The walkthrough visits pages, so these check the two things that make that
// work: every route it wants to visit exists, and every element it wants to
// point at is actually rendered somewhere.

describe('the walkthrough is a real walkthrough', () => {
  it('takes the user to more than one page', () => {
    // The whole point of the rework: a tour that only highlights sidebar links
    // is a tour of the sidebar, not of the app.
    expect(tourRoutes().length).toBeGreaterThan(8)
  })

  it('visits every section the sidebar offers', () => {
    const sidebar = readFileSync('components/Sidebar.tsx', 'utf-8')
    const navHrefs = [...sidebar.matchAll(/\{ href: '([^']+)', label:/g)].map((m) => m[1])

    expect(navHrefs.length).toBeGreaterThan(10)
    for (const href of navHrefs) {
      expect(tourRoutes(), href).toContain(href)
    }
  })

  it('only visits routes that exist', () => {
    for (const route of tourRoutes()) {
      // Route groups are invisible in the URL, so a page can live under either.
      const candidates = [
        `app${route}/page.tsx`,
        `app/(dashboard)${route}/page.tsx`,
        `app/(marketing)${route}/page.tsx`,
      ]
      expect(candidates.some(existsSync), route).toBe(true)
    }
  })

  it('points only at anchors that something actually renders', () => {
    // Scans the tree rather than a hand-listed set of files: a hardcoded list
    // goes stale the moment an anchor is added somewhere new, and then the test
    // fails for the wrong reason.
    //
    // Covers every selector the tour will hand to querySelector.
    for (const step of TOUR_STEPS) {
      if (!step.target) continue
      // A selector may list alternatives - a page that renders one of two
      // states anchors to both - so every branch has to resolve.
      for (const anchor of anchorsIn(step.target)) {
        expect(renderedAnchors(), `${step.title} -> ${anchor}`).toContain(anchor)
      }
    }
  })

  it('starts and ends on the dashboard', () => {
    // Somewhere they can get to from anywhere, and where the tour began.
    expect(TOUR_STEPS[0].route).toBe('/dashboard')
    expect(TOUR_STEPS[TOUR_LENGTH - 1].route).toBe('/dashboard')
  })

  it('opens and closes with a step about the app rather than a control', () => {
    expect(TOUR_STEPS[0].target).toBeUndefined()
    expect(TOUR_STEPS[TOUR_LENGTH - 1].target).toBeUndefined()
  })

  it('groups consecutive steps on the same page together', () => {
    // Bouncing between pages and back would make the tour feel broken even
    // though every individual step is correct. The dashboard is the exception:
    // it opens and closes the tour.
    const visits = TOUR_STEPS.map((s) => s.route).filter((route, i, all) => route !== all[i - 1])
    expect(new Set(visits).size, 'a page is visited twice').toBe(visits.length - 1)
  })
})

describe('the walkthrough only ever explains', () => {
  it('asks the user for nothing', () => {
    // It used to make each page's step block until it detected the user had
    // done the thing. That is gone on purpose and must not come back: see the
    // note at the top of lib/onboarding.ts for the two ways it failed.
    for (const step of TOUR_STEPS) {
      expect(step, step.title).not.toHaveProperty('advanceOn')
      expect(step, step.title).not.toHaveProperty('failOn')
    }

    const source = readFileSync('components/OnboardingTour.tsx', 'utf-8')
    expect(source).not.toContain('watchStepOutcome')
    expect(source).not.toContain('Skip this bit')
  })

  it('points only at things that exist before the user touches anything', () => {
    // THE RULE THAT KEEPS THE TOUR OFF THE ROUTE-PUSHING PATH. An anchor that
    // only appears after the user acts is not found on a freshly loaded page,
    // so the step spends its target timeout hunting it, invisibly, and then
    // moves on - and moving on can push a route. A run of those is what dragged
    // people back to /tailor when they tried to leave it.
    //
    // These four are the anchors that burned it: each is rendered behind state
    // that only exists once a job has been analysed or a resume tailored.
    const afterTheFact = ['job-analyzed', 'tailor-button', 'tailored-result', 'resume-present']

    for (const step of TOUR_STEPS) {
      if (!step.target) continue
      for (const anchor of anchorsIn(step.target)) {
        expect(afterTheFact, `${step.title} -> ${anchor}`).not.toContain(anchor)
      }
    }
  })

  it('still reaches every section of the app', () => {
    // Dropping the waits must not quietly drop the coverage with them.
    for (const route of [
      '/profile',
      '/tailor',
      '/tracker',
      '/jobs',
      '/strategy',
      '/networking',
      '/interview',
      '/apply',
      '/resume-studio',
      '/limits',
      '/settings',
    ]) {
      expect(tourRoutes(), route).toContain(route)
    }
  })

  it('never claims Vantage logs an application on its own', () => {
    // It does not, and saying so is worse than a typo: it tells someone their
    // applications are being tracked for them, so they stop logging any, and
    // the tracker quietly stops reflecting their search - which then feeds
    // Strategy and every AI feature that reads the history.
    //
    // The only two inserts into `applications` are the tracker's own form and
    // the Log button under the tailored result, and both need a press. Asserted
    // against the source rather than the copy so the guarantee is what is
    // checked, not the wording of one sentence.
    const tailor = readFileSync('app/(dashboard)/tailor/page.tsx', 'utf-8')
    expect(tailor).toContain("from('applications').insert")
    // The insert lives in a function the button calls, never in an effect.
    expect(tailor).toContain('async function logApplication()')

    const claims = /logs itself|logged automatically|automatically logged|logs it for you|auto-logs/i
    for (const step of TOUR_STEPS) {
      expect(claims.test(step.body), `${step.title}`).toBe(false)
    }
    expect(claims.test(readFileSync('lib/appKnowledge.ts', 'utf-8'))).toBe(false)
  })
})

describe('the walkthrough moves smoothly', () => {
  const source = readFileSync('components/OnboardingTour.tsx', 'utf-8')
  const css = readFileSync('app/globals.css', 'utf-8')

  it('eases each step in instead of snapping', () => {
    expect(css).toContain('@keyframes vantage-tour-step-in')
    expect(css).toContain('animation: vantage-tour-step-in')
  })

  it('settles opaque even if the animation is interrupted', () => {
    // The bug this prevents: a popover stranded partway through a fade is
    // faint, unreadable text sitting behind the page - which is what driver's
    // own animation did whenever it restarted mid-run.
    const rule = css.slice(css.indexOf('animation: vantage-tour-step-in'))
    expect(rule.slice(0, 120)).toContain('forwards')
    const frames = css.slice(css.indexOf('@keyframes vantage-tour-step-in'))
    expect(frames.slice(0, 220)).toContain('opacity: 1')
  })

  it('leaves the movement to CSS rather than driver', () => {
    // driver's `animate` does tween, and also leaves its transition state
    // machine half-finished: the previous target keeps driver-active-element,
    // so two elements stay highlighted. Kept off deliberately.
    expect(source).toContain('animate: false')
    expect(source).not.toContain('animate: true')
    // The instance is never stepped - it is rebuilt per step.
    expect(source).not.toContain('tourRef.current.moveTo')
  })

  it('respects prefers-reduced-motion', () => {
    // The file has several reduced-motion blocks; find the one that covers the
    // walkthrough rather than whichever happens to come first.
    const blocks = css.split('@media (prefers-reduced-motion: reduce)').slice(1)
    expect(
      blocks.some((b) => b.slice(0, 300).includes('.driver-popover.vantage-tour'))
    ).toBe(true)
  })

  it('acts on the step showing, not a stale index', () => {
    expect(source).toContain('onNextClick: () => goTo(stepRef.current + 1)')
    expect(source).toContain('onPrevClick: () => goTo(Math.max(0, stepRef.current - 1))')
  })
})

describe('the walkthrough cannot loop', () => {
  const source = readFileSync('components/OnboardingTour.tsx', 'utf-8')

  it('keeps its own final word on being finished', () => {
    // A Next layout does not re-render on client navigation, so `run` stays
    // true for the rest of the session after the tour ends - which sent it
    // round dashboard, billing, dashboard, billing forever.
    expect(source).toContain('DONE_KEY')
    expect(source).toMatch(/readSession\(DONE_KEY\) === '1'/)
  })

  it('marks itself done before anything else when finishing', () => {
    const finishBody = source.slice(source.indexOf('const finish ='), source.indexOf('const goTo ='))
    expect(finishBody.indexOf('DONE_KEY')).toBeLessThan(finishBody.indexOf('save('))
  })
})

describe('the walkthrough component', () => {
  const source = readFileSync('components/OnboardingTour.tsx', 'utf-8')

  it('waits for a step target instead of assuming it is there', () => {
    // Steps land on pages that have only just started rendering.
    expect(source).toContain('MutationObserver')
  })

  it('gives up on a target that never arrives rather than hanging', () => {
    expect(source).toContain('TARGET_TIMEOUT')
  })

  it('remembers its position in the tab, so navigating does not restart it', () => {
    expect(source).toContain('sessionStorage')
  })
})


describe('every feature is actually explained', () => {
  // The complaint that prompted this: the walkthrough visited these pages and
  // highlighted their headings. A heading is not an explanation - each of these
  // pages has a control that does the work, and the tour has to point at it and
  // say what it needs.
  const FEATURES = [
    '/tracker',
    '/jobs',
    '/strategy',
    '/networking',
    '/interview',
    '/apply',
    '/resume-studio',
  ]

  it.each(FEATURES)('%s gets a step pointing at something other than its heading', (route) => {
    const steps = TOUR_STEPS.filter((s) => s.route === route)
    expect(steps.length, `${route} has no steps`).toBeGreaterThan(0)

    const beyondHeader = steps.filter((s) => s.target && s.target !== '[data-tour="page-header"]')
    expect(beyondHeader.length, `${route} only highlights its header`).toBeGreaterThan(0)
  })

  it.each(FEATURES)('%s is explained in enough detail to be useful', (route) => {
    const longest = Math.max(
      ...TOUR_STEPS.filter((s) => s.route === route).map((s) => s.body.length)
    )
    // A one-line restatement of the page title teaches nobody anything.
    expect(longest, route).toBeGreaterThan(120)
  })

  it('warns that Strategy needs a history before it will run', () => {
    // It refuses under 15 logged applications, so a walkthrough that presented
    // it as ready to use would be setting the user up to be confused.
    const strategy = TOUR_STEPS.filter((s) => s.route === '/strategy')
    expect(strategy.some((s) => s.body.includes('15'))).toBe(true)
  })

  it('says auto-apply never submits for the user', () => {
    const apply = TOUR_STEPS.filter((s) => s.route === '/apply')
    expect(apply.some((s) => /never submits/i.test(s.body))).toBe(true)
  })
})

describe('a page that redirects cannot loop the walkthrough', () => {
  it('leaves Billing out when paid plans are off', () => {
    // /billing redirects to the dashboard unless ENABLE_FREEMIUM is 'true'. The
    // tour walked to it, got sent back, read the same step and walked to it
    // again - the dashboard/billing bounce.
    expect(stepsFor(false).some((s) => s.route === '/billing')).toBe(false)
    expect(stepsFor(true).some((s) => s.route === '/billing')).toBe(true)
  })

  it('keeps every other step either way', () => {
    expect(stepsFor(false).length).toBe(TOUR_STEPS.length - 1)
    expect(stepsFor(true).length).toBe(TOUR_STEPS.length)
  })

  // The general guard - stepping over any page that sends the tour away - is
  // covered behaviourally in tests/components/tourNavigation.test.tsx, by
  // rendering the tour and telling it the navigation did not land. Asserting on
  // the source here only ever proved a variable name existed, and broke the
  // moment that name changed.
})
