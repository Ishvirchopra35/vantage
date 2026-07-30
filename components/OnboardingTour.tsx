'use client';

// The product walkthrough.
//
// It navigates to each page and explains what that page is for. It asks for
// nothing and waits for nothing - Next always moves. Spanning pages means
// surviving a route change, so it is mounted in the dashboard layout and
// re-establishes itself on every page, driving whichever step belongs there.
//
// Things it learned the hard way, here and in globals.css:
//
//   - THE PAGE STAYS USABLE. driver's overlay swallows clicks everywhere except
//     the highlighted element, which trapped people on any step whose popover
//     mentioned a control outside the highlight. The overlay is
//     pointer-events: none.
//   - ONE DRIVER PER PAGE, NOT PER STEP. Rebuilding the instance for every step
//     is what made each step land as a hard cut: a new driver starts a new
//     overlay and a new popover with no idea where the last one was, so there is
//     nothing to animate from. Keeping the instance for the whole page lets
//     driver tween the spotlight and the popover between steps, which is the
//     smooth movement you see. Crossing to another page necessarily builds a new
//     one, and that is the only place a step still appears rather than moves.
//   - NOTHING ADVANCES ON A STRAY CLICK. Only Next, Back and Skip move it.
//
// It never acts for the user and never reads anything back from the page: it
// points, explains, and moves when told to. The only request it makes is saving
// its own position.
//
// NOTHING THAT FAILED IS COUNTED: a step whose target never appears is skipped
// rather than shown pointing at nothing, and if saving progress fails the
// walkthrough is not recorded as finished, so the user gets it again rather
// than silently losing it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
  stepsFor,
  TOUR_STEP_KEY as STEP_KEY,
  TOUR_ACTIVE_KEY as ACTIVE_KEY,
  TOUR_DONE_KEY as DONE_KEY,
  TOUR_FORCE_KEY as FORCE_KEY,
  type OnboardingState,
  type TourStep,
} from '@/lib/onboarding';

interface OnboardingTourProps {
  /** Whether the walkthrough is unfinished. Read on the server. */
  run: boolean;
  /** Where they got to last time. */
  startAt: number;
  /**
   * Whether /billing will actually load rather than redirect away.
   *
   * This is ENABLE_FREEMIUM, the server flag, NOT the NEXT_PUBLIC_ one. They can
   * disagree and on this project they do: the public flag shows Billing in the
   * sidebar while the server flag makes the page redirect to the dashboard. The
   * tour was gated on the public flag, so it still walked to a page that bounced
   * it - which is the loop, and gating on the wrong flag did not fix it.
   */
  includeBilling: boolean;
}

/** How long to wait for a step's target before giving up on that step. */
const TARGET_TIMEOUT = 4000;
/**
 * How long a navigation gets before the page is treated as refusing to load.
 *
 * Generous on purpose: a slow page is not a redirect, and skipping a real step
 * because the connection was slow is worse than waiting a moment on the rare
 * page that does send us away.
 */
const BOUNCE_GRACE = 2500;
/**
 * The most pages the walkthrough will ever navigate to in one session.
 *
 * Comfortably more than the tour needs. It exists because every loop so far had
 * a different cause - a redirecting page, a stale prop, a stale index - so this
 * is the backstop for whatever the next one turns out to be.
 */
const MAX_PUSHES = 60;
/** Longest we will wait for the page to go idle before starting anyway. */
const HYDRATION_CEILING = 1200;
/** Fallback settle time where requestIdleCallback is unavailable (Safari). */
const HYDRATION_SETTLE = 400;

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private mode. The database copy still carries it between visits.
  }
}

function clearSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Records progress. Retried once, because the write that matters most happens
 * exactly when the user is likely to be navigating away.
 */
async function save(state: Partial<OnboardingState>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
        keepalive: true,
      });
      if (response.ok) return true;
    } catch {
      // Offline or navigating away. Fall through to the retry.
    }
  }
  return false;
}

/**
 * Waits until the page has finished hydrating before the tour touches it.
 *
 * THIS IS NOT A COSMETIC DELAY. driver.js highlights an element by MUTATING it -
 * it adds a class, aria-haspopup, aria-expanded and aria-controls, and marks the
 * parent. Those are nodes React owns. The tour lives in the layout, and a
 * layout's effects run before the page segment below it has hydrated, so driver
 * was reaching into not-yet-hydrated DOM. React then hydrated, found attributes
 * it did not write, reported a mismatch and threw the subtree away - taking the
 * element the tour was pointing at with it.
 *
 * That is what made the walkthrough erratic: steps that showed on one page and
 * not another, popovers that vanished, and behaviour that changed on reload.
 */
function waitForHydration(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();

    const done = () => resolve();
    // Idle means React has finished its commit work, which is the signal that
    // matters. The timeout is the ceiling for a busy page.
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(done, { timeout: HYDRATION_CEILING });
    } else {
      setTimeout(done, HYDRATION_SETTLE);
    }
    signal.addEventListener('abort', done);
  });
}

/** Resolves when `selector` matches something, or null on timeout (0 = never). */
export function waitForElement(
  selector: string,
  signal: AbortSignal,
  timeout: number
): Promise<Element | null> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(null);

    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (value: Element | null) => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
      resolve(value);
    };

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) finish(found);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    if (timeout > 0) timer = setTimeout(() => finish(null), timeout);
    signal.addEventListener('abort', () => finish(null));
  });
}

/**
 * Which step this session should be on, or null when the tour should not run.
 *
 * `run` comes from the layout, and a Next layout does not re-render on
 * client-side navigation - so it is stale in both directions once the tour has
 * moved. The tab's own flags override it: FORCE to start regardless, DONE to
 * stay stopped.
 */
function resolveStartingStep(run: boolean, startAt: number, length: number): number | null {
  const forced = readSession(FORCE_KEY) === '1';
  if (forced) clearSession(FORCE_KEY);
  if (!forced && (!run || readSession(DONE_KEY) === '1')) return null;

  const wasActive = !forced && readSession(ACTIVE_KEY) === '1';
  writeSession(ACTIVE_KEY, '1');

  if (forced) {
    // Someone replaying it wants the whole thing, not their old position.
    writeSession(STEP_KEY, '0');
    return 0;
  }

  // Parsed from the raw string, NOT via Number() alone: Number(null) is 0, so a
  // missing key read as a legitimate "step 0" and restarted the walkthrough from
  // the beginning. That is reachable - resuming from the server sets ACTIVE_KEY
  // but only pressing Next writes STEP_KEY - so someone who came back to step 6
  // and reloaded the page lost their place. A missing key means "nothing stored
  // in this tab", which is exactly when the server's position should win.
  const raw = readSession(STEP_KEY);
  const stored = raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
  return Math.min(
    wasActive && Number.isInteger(stored) && stored >= 0 ? stored : startAt,
    length - 1
  );
}

export default function OnboardingTour({
  run,
  startAt,
  includeBilling,
}: OnboardingTourProps): null {
  const router = useRouter();
  const pathname = usePathname();
  const tourRef = useRef<Driver | null>(null);
  // The route the tour itself asked for, or null when it has not asked for
  // anything. This is how a navigation the tour started is told apart from one
  // the user started - without it the tour cannot know whether to wait or to
  // leave them alone.
  const asked = useRef<string | null>(null);
  // A hard ceiling on navigations per session. Every loop so far had a
  // different cause, so this is the backstop for the next one: past this the
  // walkthrough stops navigating entirely rather than bouncing a user around
  // their own app.
  const pushes = useRef(0);
  // Whether the tour has been allowed its one trip to the page it is resuming
  // on. Someone who stopped on /tailor and comes back to the dashboard should
  // be taken to /tailor once - that is the tour resuming, not the tour
  // overruling them. Every mismatch after this is the user navigating, and is
  // left alone.
  const resumed = useRef(false);
  // The step the live driver's buttons act on, so a callback can never act on a
  // stale index.
  const stepRef = useRef(0);

  const steps = useMemo(() => stepsFor(includeBilling), [includeBilling]);
  const length = steps.length;

  // The active step. Every step now shares one driver per page - the config is
  // the same for all of them, so there is nothing per-step left to rebuild for,
  // and keeping the instance is what lets the steps animate between each other.
  //
  // Resolved at first render rather than in an effect. That keeps the read of
  // sessionStorage out of an effect body - and this component renders nothing
  // in either case, so there is no hydration mismatch to cause.
  const [index, setIndex] = useState<number | null>(() =>
    typeof window === 'undefined' ? null : resolveStartingStep(run, startAt, stepsFor(includeBilling).length)
  );

  /** Ends the walkthrough for good, one way or the other. */
  const finish = useCallback((at: number, reason: 'completed' | 'skipped') => {
    // Written before anything else: this is what stops the effect running again
    // with a stale `run` from the layout, which used to loop the tour.
    writeSession(DONE_KEY, '1');
    clearSession(ACTIVE_KEY);
    clearSession(STEP_KEY);
    setIndex(null);
    void save({ step: at, completed: reason === 'completed', skipped: reason === 'skipped' });
  }, []);

  /** Moves to `next`, navigating first when it lives on another page. */
  const goTo = useCallback(
    (next: number) => {
      tourRef.current?.destroy();
      tourRef.current = null;

      if (next >= length) {
        finish(length - 1, 'completed');
        return;
      }

      writeSession(STEP_KEY, String(next));
      void save({ step: next });

      // The index moves FIRST, whether or not a navigation follows. Setting it
      // only on the same-page branch meant that after navigating, `index` still
      // pointed at the step on the previous page - and the effect below, seeing
      // a step whose route did not match, pushed straight back to it. That was
      // the step 5 to 6 to 5 bounce.
      setIndex(next);

      const target = steps[next];
      if (target.route === pathname) return;

      if (pushes.current >= MAX_PUSHES) {
        // Something is wrong. Stop navigating rather than keep moving someone
        // around their own app, and let them carry on by hand.
        asked.current = null;
        return;
      }

      pushes.current += 1;
      asked.current = target.route;
      router.push(target.route);
    },
    [finish, length, pathname, router, steps]
  );

  // Gets the tour onto the page its step belongs to - and, crucially, only ever
  // when the tour itself asked to go there.
  //
  // THE TOUR NEVER FIGHTS THE USER. This effect used to push back to the
  // current step's page whenever the pathname did not match, with no idea who
  // had navigated. Press Next on a step that was waiting, then try to visit any
  // other page, and it dragged you straight back - the walkthrough held you
  // hostage on one page. A walkthrough is a suggestion, not a cage: if the user
  // goes somewhere else, it goes quiet and keeps its place, and picks up again
  // if they return to that page.
  useEffect(() => {
    if (index === null) return;
    const step = steps[index];

    if (step.route === pathname) {
      asked.current = null;
      resumed.current = true;
      return;
    }

    // First run of this session with the saved step on another page: take them
    // there once. That is the walkthrough resuming, not overruling them.
    if (!resumed.current && asked.current === null) {
      resumed.current = true;
      if (pushes.current < MAX_PUSHES) {
        pushes.current += 1;
        asked.current = step.route;
        router.push(step.route);
      }
    }

    // Not the page we asked for, and we are not waiting on anything: the user
    // navigated here themselves. Leave them alone - keeping the position, so
    // returning to the step's page picks it back up.
    if (asked.current !== step.route) {
      asked.current = null;
      return;
    }

    // Waiting for a navigation we started. Give it a moment: a slow page is not
    // a refusal, and counting attempts instead of waiting skipped real steps on
    // a slow connection. A successful navigation changes the pathname, which
    // re-runs this effect and clears the timer before it can fire.
    const timer = setTimeout(() => {
      // Give up on this page, and on every other step that lives there - a page
      // that will not load does not load once per step.
      let next = index + 1;
      while (next < steps.length && steps[next].route === step.route) next += 1;
      asked.current = null;
      goTo(next);
    }, BOUNCE_GRACE);
    return () => clearTimeout(timer);
  }, [index, pathname, router, steps, goTo]);

  // Shows it. Runs again for every step, so the driver's configuration always
  // belongs to the step on screen.
  useEffect(() => {
    if (index === null) return;
    // Bound to a local so every closure below carries a number rather than
    // re-narrowing `index` inside each callback.
    const at = index;
    const step = steps[at];
    if (step.route !== pathname) return;

    const controller = new AbortController();

    async function show() {
      // Before anything else: let the page hydrate. Highlighting an element
      // React has not finished claiming makes React discard it.
      await waitForHydration(controller.signal);
      if (controller.signal.aborted) return;

      if (step.target) {
        const found = await waitForElement(step.target, controller.signal, TARGET_TIMEOUT);
        if (controller.signal.aborted) return;
        if (!found) {
          // Never arrived. Skip it rather than show it pointing at nothing.
          //
          // Every target in the tour is supposed to be on the page the moment it
          // loads, so this is the "something changed and nobody updated the
          // tour" path rather than a routine one - which is why it is allowed to
          // move on rather than sit there.
          goTo(at + 1);
          return;
        }
        // Hydration can replace the node between finding it and using it, so
        // the one driver is handed has to still be in the document.
        if (!found.isConnected) {
          const again = await waitForElement(step.target, controller.signal, TARGET_TIMEOUT);
          if (controller.signal.aborted || !again) return;
        }
      }
      if (controller.signal.aborted) return;

      // One driver per step, rebuilt each time.
      //
      // Reusing the instance across a page and stepping it with moveTo() was
      // tried, to let driver tween the spotlight between targets. It does tween
      // - and it also leaves its transition state machine half-finished: the
      // previous target keeps its `driver-active-element` class, so two elements
      // end up highlighted at once, and the popover can land showing the last
      // step's text at zero size. Both of those are worse than a hard cut.
      //
      // So the smoothness is done in CSS instead, where nothing can go stale:
      // the popover is rebuilt per step and eases itself in (see
      // .driver-popover.vantage-tour in globals.css). driver's own `animate` is
      // off for the same reason it always was - its fade leaves the popover
      // stranded at partial opacity whenever it is restarted mid-run.
      tourRef.current?.destroy();
      stepRef.current = at;

      const tour = driver({
        animate: false,
        overlayOpacity: 0.7,
        showProgress: true,
        progressText: 'Step {{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Finish',
        allowClose: true,
        // A no-op. 'nextStep' meant any stray click on the backdrop advanced.
        overlayClickBehavior: () => {},
        popoverClass: 'vantage-tour',
        stagePadding: 6,
        steps: steps.map((s) => ({
          element: s.target,
          popover: { title: s.title, description: s.body },
        })),
        // Relabelled here rather than in CSS: replacing the text with a ::after
        // left the visible word and the clickable box in different places, so
        // the button only responded to a click above the label.
        onPopoverRender: (popover) => {
          if (popover.closeButton) {
            popover.closeButton.textContent = 'Skip tour';
            popover.closeButton.setAttribute('aria-label', 'Skip the walkthrough');
          }
        },
        onNextClick: () => goTo(stepRef.current + 1),
        onPrevClick: () => goTo(Math.max(0, stepRef.current - 1)),
        onCloseClick: () => {
          const leftAt = stepRef.current;
          tourRef.current?.destroy();
          tourRef.current = null;
          finish(leftAt, 'skipped');
        },
        onDestroyStarted: () => {
          const leftAt = stepRef.current;
          tourRef.current?.destroy();
          tourRef.current = null;
          if (leftAt >= length - 1) finish(length - 1, 'completed');
        },
      });

      tourRef.current = tour;
      tour.drive(at);
    }

    void show();

    return () => {
      controller.abort();
      tourRef.current?.destroy();
      tourRef.current = null;
    };
  }, [index, pathname, goTo, finish, steps, length]);

  return null;
}
