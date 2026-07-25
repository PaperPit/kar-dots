/** true, если расширение ещё «живо» для этого content script. */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id
  } catch {
    return false
  }
}

export function showReloadHint(): void {
  const id = "kar-ext-reload-hint"
  if (document.getElementById(id)) return
  const el = document.createElement("div")
  el.id = id
  el.textContent = "КАР-точки обновилось — нажми Cmd+R (или F5), чтобы перезагрузить YouTube"
  el.setAttribute(
    "style",
    [
      "position:fixed",
      "left:50%",
      "bottom:24px",
      "transform:translateX(-50%)",
      "z-index:2147483647",
      "max-width:min(480px,calc(100vw - 24px))",
      "padding:12px 16px",
      "border-radius:12px",
      "background:#1c1611",
      "color:#fbf7ef",
      "font:600 13px/1.35 Segoe UI,system-ui,sans-serif",
      "box-shadow:0 10px 30px rgba(0,0,0,.35)",
      "cursor:pointer"
    ].join(";")
  )
  el.title = "Нажми, чтобы перезагрузить страницу"
  el.addEventListener("click", () => location.reload())
  document.documentElement.appendChild(el)
}
