/** A random id. Not crypto.randomUUID(): that needs a secure context, and the single-file build runs from file://. */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
