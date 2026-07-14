// Timeout wrapper - every AI call and external fetch goes through this so a
// hung upstream can never hold a serverless function open past its budget.

/**
 * Races `promise` against a timer. Rejects with a labeled Error after `ms`
 * milliseconds; the label shows up in logs to identify which call hung.
 * Note the underlying promise keeps running - this only unblocks the caller.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms while waiting for ${label}`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default withTimeout;
