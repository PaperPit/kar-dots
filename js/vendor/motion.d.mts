export function animate(
  element: Element,
  keyframes: Record<string, unknown>,
  options?: Record<string, unknown>
): { finished: Promise<void> }
