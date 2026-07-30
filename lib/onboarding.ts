// The product walkthrough: what it covers, and how far someone got.
//
// Shared by the client that runs the tour and the route that stores progress,
// so the two can never disagree about how many steps there are.
//
// It is a guided read, not a set of chores. Each step names the page it belongs
// on, the tour navigates there first, and the step explains what that page is
// for while the user is looking at it. It asks for nothing and waits for
// nothing: Next always moves, so the walkthrough can be finished in a minute
// and nobody is ever held on a step.
//
// IT USED TO WAIT, AND THAT IS WHY IT DOES NOT NOW. An earlier version had each
// page's step ask the user to do the thing - upload, analyse, tailor, log - and
// block until it detected they had. Two things went wrong, and both were
// structural rather than tunable:
//
//   - HALF THE ANCHORS DID NOT EXIST YET. A step pointing at the tailored-resume
//     panel points at markup that only exists after a job has been analysed and
//     a resume tailored. Skip that work and the tour spends four seconds hunting
//     each missing anchor, invisibly, then gives up on it - and every one of
//     those give-ups can push a route. Pressing "skip this bit" on the Analyze
//     step left the popover gone but the tour still walking the rest of /tailor,
//     so trying to go anywhere else dragged the user back until the chain ran
//     out, and then dumped them on Applications.
//   - A WALKTHROUGH IS NOT SOMETHING YOU CAN FAIL. Making someone produce output
//     before they may read the next sentence turns an explanation into a gate,
//     and a gate in front of a third-party lookup that can fail is a dead end.
//
// So EVERY TARGET HERE MUST BE PRESENT ON PAGE LOAD, with nothing typed and
// nothing generated. That single rule is what keeps the tour off the
// route-pushing path above, and a test enforces it.

/** One stop on the walkthrough. */
export interface TourStep {
  /**
   * The page this step belongs on. The tour navigates here first, so the step
   * is explained while the user is looking at it.
   */
  route: string;
  /**
   * What to highlight, as a `data-tour` attribute rather than a class or a
   * structural selector, so restyling a component cannot silently break the
   * tour. Omitted for a step about the page as a whole, which renders centred.
   *
   * MUST resolve on a freshly loaded page - see the note at the top of the file.
   * An anchor that only appears once the user has done something is what made
   * the previous version shove people back onto pages they had left.
   */
  target?: string;
  title: string;
  body: string;
  /**
   * Only include this step when paid plans are switched on.
   *
   * /billing redirects to the dashboard when ENABLE_FREEMIUM is not 'true', so
   * a tour that walked to it bounced straight back, read the same step again and
   * walked to it again - the dashboard/billing loop. A step whose page will not
   * hold still must not be in the list at all.
   */
  freemiumOnly?: boolean;
}

const HEADER = '[data-tour="page-header"]';

/**
 * Every section of the app, explained on the page it lives on.
 *
 * Deliberately the full walkthrough. Long tours are known to lose people -
 * completion falls off sharply past a handful of steps - so the mitigation
 * here is not to cut it short but to make leaving cheap: the position is saved
 * after every step, Skip is always available, and returning resumes rather
 * than restarting.
 *
 * Where a page has more screens than the tour can reach without driving it, the
 * step describes the flow in words instead of pointing at it. /tailor is the one
 * that matters: its later screens do not exist until a job has been analysed.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    route: '/dashboard',
    title: 'Welcome to Vantage',
    body: 'A quick tour of what is here and what each part does. It is only an explanation - nothing gets created, nothing is sent, and none of your monthly uses are touched. Press Next to move on, or Skip tour whenever you like. If you leave partway it picks up where you stopped.',
  },
  {
    route: '/dashboard',
    target: HEADER,
    title: 'Your dashboard',
    body: 'Where you land each time: applications tracked, how many are getting replies, interviews in flight, and your average ATS score. It fills in as you use the app.',
  },

  // Profile first: everything downstream reads from the resume, so a
  // walkthrough that left it to the end would be teaching the app backwards.
  {
    route: '/profile',
    target: HEADER,
    title: 'Start with your profile',
    body: 'The most important page. Every AI feature reads from it, so this is what makes the output specific to you rather than generic - your skills, target roles, university and experience.',
  },
  {
    route: '/profile',
    target: '[data-tour="resume-upload"]',
    title: 'Your resume goes here',
    body: 'Upload once and everything else works from it. Use a Word (.docx) file if you have one: tailored resumes then come back as that exact document with new wording in it, keeping your fonts and layout. A PDF works too, but downloads use a clean Vantage layout instead of your own design. Vantage also fills in the rest of your profile from whatever you upload.',
  },

  {
    route: '/tailor',
    target: HEADER,
    title: 'Tailor + ATS',
    body: 'The main event. Give it a job posting and it rewrites your bullet points to speak that job’s language, then scores the result the way an applicant tracking system would.',
  },
  {
    route: '/tailor',
    target: '[data-tour="job-input"]',
    title: 'How it works',
    body: 'Paste a job link and press Analyze - or, if a site blocks us or needs a login, switch to pasting the description text straight in. Vantage pulls out the requirements and keywords, shows you what it understood, and then offers three things: tailor your resume to the posting, score it, and write a cover letter. Only your bullet points ever change - headings, employers, job titles and dates come through exactly as you wrote them.',
  },

  {
    route: '/tracker',
    target: HEADER,
    title: 'Applications',
    body: 'Every job you apply to and what came back. Vantage reads this to work out which of your resumes actually get replies, so it is worth keeping current.',
  },
  {
    route: '/tracker',
    target: '[data-tour="log-application"]',
    title: 'Logging one',
    body: 'Company, role, and the date you applied. Then move it along as things happen: Applied, Interviewing, Offer, Rejected, or Ghosted if it goes quiet. Tailoring on the Tailor + ATS page ends with a Log button filled in from the posting, but you still have to press it, so nothing lands here that you did not put here.',
  },

  {
    route: '/jobs',
    target: HEADER,
    title: 'Job feed',
    body: 'Openings pulled in and ranked against the target roles and skills on your profile, so the closest matches come first.',
  },
  {
    route: '/jobs',
    target: '[data-tour="refresh-jobs"]',
    title: 'Finding new ones',
    body: 'Find new fetches a fresh batch. Save anything worth a look and it carries into Tailor + ATS with the description already attached, so you skip the pasting. Dismiss the rest and they stop coming back.',
  },

  {
    route: '/strategy',
    target: '[data-tour="strategy-report"]',
    title: 'Strategy',
    body: 'This one reads your applications back to you: which companies and levels are answering, where you are being screened out, and what to change. It needs at least 15 logged applications before it will run, because below that any pattern it found would be noise - so if this page is still empty, that is what it is waiting for.',
  },

  {
    route: '/networking',
    target: HEADER,
    title: 'Networking',
    body: 'For reaching people directly at the companies you are applying to, which is how a lot of these actually get answered.',
  },
  {
    route: '/networking',
    target: '[data-tour="networking-generate"]',
    title: 'How a message gets written',
    body: 'Give it the person - name, title, company - and pick connection request, cold email, or follow-up. It writes from your background and theirs rather than a template, and you edit before sending. Nothing is ever sent for you.',
  },

  {
    route: '/interview',
    target: HEADER,
    title: 'Interview Prep',
    body: 'For when one of these turns into an actual interview.',
  },
  {
    route: '/interview',
    target: '[data-tour="interview-start"]',
    title: 'How practice works',
    body: 'Pick a job from your tracker, or type the role in by hand. It generates questions from that specific posting and your background, then scores each answer you type or speak and tells you what to fix. Sessions are saved, so you can come back to one.',
  },

  {
    route: '/apply',
    target: '[data-tour="apply-setup"]',
    title: 'Auto-apply',
    body: 'Install the Chrome extension and connect it once with the code on this page. After that, open any application form and it fills from your profile - including the awkward Workday and Greenhouse ones. It fills and stops: you check everything and press submit yourself. Vantage never submits for you.',
  },

  {
    route: '/resume-studio',
    // Either state: the Studio keeps its open document in the browser, so a
    // returning user lands in the editor, where the source picker does not exist
    // at all. Anchoring only to the picker made this step skip itself for them.
    target: '[data-tour="studio-sources"], [data-tour="studio-loaded"]',
    title: 'Resume Studio',
    body: 'For polishing by hand. Open a resume you already tailored, your base resume, or a file. Then either click any line to edit it directly, or type an instruction like "cut the summary to two lines" and let it apply. Downloads keep your own formatting, same as everywhere else. Still experimental.',
  },

  {
    route: '/limits',
    target: HEADER,
    title: 'Usage Limits',
    body: 'What you have used this month and what is left, feature by feature, and when it resets. Only successful runs count - if something fails, it does not cost you anything.',
  },
  {
    route: '/billing',
    target: HEADER,
    freemiumOnly: true,
    title: 'Billing',
    body: 'Your plan and payment details.',
  },
  {
    route: '/settings',
    target: HEADER,
    title: 'Settings',
    body: 'Theme, replacing your base resume, email preferences, and account controls. Replaying this walkthrough is here too, whenever you want it again.',
  },
  {
    route: '/dashboard',
    title: 'That is the tour',
    body: 'The loop from here: find a job, tailor your resume to it, apply, log it. The more you log, the more Strategy and the tailoring have to work with. Everything you just saw is in the sidebar, and the help button in the bottom right answers questions any time.',
  },
];

/** The steps that apply, given whether paid plans are switched on. */
export function stepsFor(enableFreemium: boolean): TourStep[] {
  return TOUR_STEPS.filter((step) => !step.freemiumOnly || enableFreemium);
}

export const TOUR_LENGTH = TOUR_STEPS.length;

/** Every page the walkthrough visits, in order, without repeats. */
export function tourRoutes(): string[] {
  return [...new Set(TOUR_STEPS.map((step) => step.route))];
}

// -- where the tab keeps its copy ---------------------------------------------
//
// Shared with the component and with Settings, because three places have to
// agree about these and magic strings in three files is how they stop agreeing.

/** The step the tour is on, so a route change does not restart it. */
export const TOUR_STEP_KEY = 'vantage-tour-step';
/** Set while a walkthrough is in progress in this tab. */
export const TOUR_ACTIVE_KEY = 'vantage-tour-active';
/**
 * Set the moment the walkthrough ends.
 *
 * A Next layout does not re-render on client-side navigation, so the `run` prop
 * it passes down is stale for the rest of the session once the tour has moved.
 * This is the tab's own final word, and without it the tour drove itself in a
 * loop after finishing.
 */
export const TOUR_DONE_KEY = 'vantage-tour-done';
/**
 * Set to start the walkthrough regardless of what the server last said.
 *
 * Needed for exactly the same reason as the flag above, in the other direction:
 * Settings renders with the tour already finished, so the layout on the way to
 * the dashboard still says "do not run" - which is why pressing Replay did
 * nothing at all. The request that resets the database still goes out, so the
 * reset survives a reload; this is what makes it take effect immediately.
 */
export const TOUR_FORCE_KEY = 'vantage-tour-force';

/**
 * Clears the tab's copy and asks for the walkthrough to start again.
 *
 * Called by Settings before navigating. Deliberately clears TOUR_DONE_KEY too -
 * forgetting it was the second half of why Replay appeared to do nothing.
 */
export function requestWalkthrough(): void {
  try {
    sessionStorage.removeItem(TOUR_STEP_KEY);
    sessionStorage.removeItem(TOUR_ACTIVE_KEY);
    sessionStorage.removeItem(TOUR_DONE_KEY);
    sessionStorage.setItem(TOUR_FORCE_KEY, '1');
  } catch {
    // Private mode: the database reset still applies on the next full load.
  }
}

// -- stored progress ----------------------------------------------------------

export interface OnboardingState {
  /** How far they got, 0-based. */
  step: number;
  completed: boolean;
  skipped: boolean;
  /** ISO timestamp of the last time they moved through it. */
  seenAt?: string;
}

/** Nobody has started it yet. */
export const NOT_STARTED: OnboardingState = { step: 0, completed: false, skipped: false };

/**
 * Reads whatever is in the column into a usable state.
 *
 * Assumes nothing: the column is jsonb, so it can hold anything a past version
 * of this code wrote, and a walkthrough that crashed the dashboard on a
 * malformed row would be worse than one nobody sees.
 */
export function readOnboarding(value: unknown): OnboardingState {
  if (!value || typeof value !== 'object') return NOT_STARTED;
  const stored = value as Record<string, unknown>;

  const step =
    typeof stored.step === 'number' && Number.isInteger(stored.step) && stored.step >= 0
      ? // Clamped, so removing a step from the tour cannot strand someone past
        // the end of it with nothing to show.
        Math.min(stored.step, TOUR_LENGTH - 1)
      : 0;

  return {
    step,
    completed: stored.completed === true,
    skipped: stored.skipped === true,
    seenAt: typeof stored.seenAt === 'string' ? stored.seenAt : undefined,
  };
}

/**
 * Whether the walkthrough should run for this user.
 *
 * Skipping is as final as finishing. Someone who dismissed it does not want to
 * see it again, and re-offering it is how a helpful thing becomes an annoying
 * one - Settings has a replay button for when they change their mind.
 */
export function shouldRunTour(state: OnboardingState): boolean {
  return !state.completed && !state.skipped;
}
