// ============================================================
// КАР-точки — минимальные графики без зависимостей (CSS-бары)
// ============================================================

import { el } from "../ui/ui.js"

export interface Bar {
  label: string
  value: number
  title?: string
  accent?: boolean
}

/** Столбчатая диаграмма из div-баров (тема-адаптивная, отзывчивая). */
export function barChart(bars: Bar[], opts: { max?: number } = {}): HTMLElement {
  const peak = opts.max ?? Math.max(1, ...bars.map((b) => b.value))
  const cols = bars.map((b) => {
    const pct = peak > 0 ? (b.value / peak) * 100 : 0
    const fill = el("div", { class: "chart-bar-fill" + (b.accent ? " accent" : "") }, []) as HTMLElement
    fill.style.height = (b.value > 0 ? Math.max(4, Math.round(pct)) : 0) + "%"
    const bar = el(
      "div",
      { class: "chart-bar", title: b.title ?? b.label + ": " + b.value },
      [fill]
    )
    return el("div", { class: "chart-col" }, [bar, el("div", { class: "chart-xlabel" }, b.label)])
  })
  return el("div", { class: "chart-bars" }, cols)
}
