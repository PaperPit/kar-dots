/** Disposer текущего экрана — вызывается роутером перед сменой маршрута. */
type Disposer = () => void | Promise<void>

let current: Disposer | null = null

export function setRouteDisposer(fn: Disposer | null): void {
  current = fn
}

export async function runRouteDisposer(): Promise<void> {
  const fn = current
  current = null
  if (fn) await fn()
}
