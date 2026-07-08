/**
 * Safe-array guard. Returns the value unchanged when it is already an array,
 * otherwise returns an empty array. Used to defend .map()/.length against
 * null | undefined | non-array API fields.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
