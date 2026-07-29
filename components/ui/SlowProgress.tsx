'use client';

// What a long wait looks like once a spinner has stopped being convincing.
//
// A spinner says "something is happening". After about five seconds it stops
// saying that and starts looking like something has hung, because a spinner
// that has been turning for thirty seconds is indistinguishable from one that
// will turn forever. So past a threshold this replaces it with the two things
// a waiting user actually wants: what is happening right now, and roughly how
// much of the wait is left.
//
// HONESTY: the bar is a TIME ESTIMATE, not server-reported progress. These
// routes are single request/response calls with nothing to report progress
// with, so the bar is drawn against how long each step usually takes. Two
// consequences are deliberate:
//
//   - no percentage is ever shown. A number invites the reader to treat it as
//     measured, and it is not.
//   - the bar never reaches the end on its own. It eases toward a stop short
//     of full and waits there, because filling it while the request is still
//     running would be the one thing a progress bar must never do.
//
// The step labels ARE accurate: each names a real stage of the route being
// waited on, in the order the server performs them.

import { useEffect, useState } from 'react';

/** One step of the work, and how long that step usually takes. */
export interface LoadStage {
  label: string;
  seconds: number;
}

interface SlowProgressProps {
  /** True while the request is in flight. */
  active: boolean;
  /** The steps, in the order the server performs them. */
  stages: LoadStage[];
  /**
   * How long to wait before showing anything. Below this the spinner is doing
   * its job and a progress bar would be noise on an operation that was about
   * to finish anyway.
   */
  after?: number;
  style?: React.CSSProperties;
}

const TICK = 250;

/** How far the bar may travel while the request is still running. */
const CEILING = 0.94;

export default function SlowProgress({
  active,
  stages,
  after = 5000,
  style,
}: SlowProgressProps): React.ReactElement | null {
  // The timer lives in a child that only exists while the request does, so
  // each run starts from zero because it is a fresh mount - no clock to reset,
  // and no chance of a second request briefly rendering the first one's
  // elapsed time and flashing a half-full bar.
  if (!active) return null;
  return <Ticking stages={stages} after={after} style={style} />;
}

function Ticking({
  stages,
  after,
  style,
}: Omit<SlowProgressProps, 'active'> & { after: number }): React.ReactElement | null {
  const [elapsed, setElapsed] = useState(0);

  // Counted in ticks rather than read off the clock. That keeps render pure,
  // and it means a backgrounded tab - where browsers throttle timers - does
  // not come back with the bar jumped forward as though work had happened.
  useEffect(() => {
    const timer = setInterval(() => setElapsed((ms) => ms + TICK), TICK);
    return () => clearInterval(timer);
  }, []);

  if (elapsed < after || stages.length === 0) return null;

  const total = stages.reduce((sum, stage) => sum + stage.seconds, 0) * 1000;
  const seconds = elapsed / 1000;

  // The step whose window contains the current moment.
  let index = 0;
  let consumed = 0;
  for (const [i, stage] of stages.entries()) {
    if (seconds < consumed + stage.seconds) {
      index = i;
      break;
    }
    consumed += stage.seconds;
    index = i;
  }

  const overrunning = elapsed >= total;
  const fraction = overrunning ? CEILING : Math.min(elapsed / total, CEILING);

  return (
    <div
      className="slow-progress"
      style={style}
      role="status"
      aria-live="polite"
      data-testid="slow-progress"
    >
      <div className="slow-progress-label">
        {overrunning ? 'Still working on it. This one is taking longer than usual.' : stages[index].label}
      </div>
      <div className="slow-progress-track">
        <div
          className={`slow-progress-bar${overrunning ? ' slow-progress-bar-waiting' : ''}`}
          style={{ width: `${(fraction * 100).toFixed(1)}%` }}
        />
      </div>
      <div className="slow-progress-steps">
        {overrunning ? 'Nearly done' : `Step ${index + 1} of ${stages.length}`}
      </div>
    </div>
  );
}
