// Uniform JSON response helpers - every API route answers through these so
// clients can always rely on `{ error: string }` for failures.
import { NextResponse } from 'next/server';

/** 200 (or `status`) with the given JSON payload. */
export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized() {
  return err('Unauthorized', 401);
}

export function notFound(resource: string) {
  return err(`${resource} not found`, 404);
}

export function forbidden(reason: string) {
  return err(`Forbidden: ${reason}`, 403);
}

export function rateLimited(feature: string, limit: number, resetDays: number) {
  const message = `Rate limit exceeded for ${feature}. Limit: ${limit}. Try again in ${resetDays} day(s) or upgrade to Pro.`;
  return err(message, 429);
}

export function serverError(e: unknown) {
  // Log the real error server-side (visible in server logs), but never leak
  // internal details to the client - return a generic, user-friendly message.
  console.error('[serverError]', e);
  return err('Something went wrong on our end. Please try again.', 500);
}

export default {
  ok,
  err,
  unauthorized,
  notFound,
  forbidden,
  rateLimited,
  serverError,
};
