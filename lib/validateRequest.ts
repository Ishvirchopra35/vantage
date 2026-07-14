// Request-body validation shared by all POST API routes.

/**
 * Checks that `body` is a JSON object containing every key in `required`
 * (present and non-null - values are NOT type-checked beyond that; routes
 * add their own length/shape checks). Returns a discriminated union so the
 * caller gets a typed `data` only on the valid branch.
 */
export function validateBody<T extends Record<string, unknown>>(body: unknown, required: (keyof T)[]): { valid: true; data: T } | { valid: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const obj = body as Record<string, unknown>;

  for (const key of required) {
    const val = obj[String(key)];
    if (val === undefined || val === null) {
      return { valid: false, error: `Missing required field: ${String(key)}` };
    }
  }

  return { valid: true, data: obj as T };
}

export default validateBody;
