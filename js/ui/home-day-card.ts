import { el, plural } from "./ui.js"
import {
  loadActivity,
  dayKey,
  dayKnownFailed,
  WEEKDAY_NAMES
} from "../lib/activity.js"

const HERO_VIEW_KEY = "kar_hero_view"

export type HeroView = "ring" | "week"

export function getHeroView(): HeroView {
  try {
    return localStorage.getItem(HERO_VIEW_KEY) === "week" ? "week" : "ring"
  } catch {
    return "ring"
  }
}

export function setHeroView(view: HeroView): void {
  try {
    localStorage.setItem(HERO_VIEW_KEY, view)
  } catch {}
}

function greetingText(): string {
  const h = new Date().getHours()
  if (h < 12) return "Доброе утро 👋"
  if (h < 18) return "Добрый день 👋"
  return "Добрый вечер 👋"
}

export function homeGreeting(dueCount: number): HTMLElement {
  return el("div", { class: "home-greeting" }, [
    el("div", { class: "home-greeting-title" }, greetingText()),
    el(
      "div",
      { class: "home-greeting-sub" },
      dueCount <= 0
        ? "На сегодня всё повторено — можно отдыхать"
        : dueCount === 1
          ? "1 карточка ждёт повторения"
          : `${dueCount} ${plural(dueCount, "карточка", "карточки", "карточек")} ждут повторения`
    )
  ])
}

function weekBarsData(): {
  label: string
  known: number
  failed: number
  isToday: boolean
}[] {
  const data = loadActivity()
  const today = new Date()
  const dow = (today.getDay() + 6) % 7 // 0 = Mon
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow)
  monday.setHours(12, 0, 0, 0)

  const labels = WEEKDAY_NAMES.map((w) => w.toLowerCase())
  const bars = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = dayKey(d)
    const { known, failed } = dayKnownFailed(data.days[key])
    bars.push({
      label: labels[i] || "",
      known,
      failed,
      isToday: key === dayKey(today)
    })
  }
  return bars
}

function ringGradient(known: number, failed: number, total: number): string {
  if (total <= 0) return "conic-gradient(var(--bg-sunken) 0 100%)"
  const okPct = (known / total) * 100
  const failPct = (failed / total) * 100
  return `conic-gradient(var(--ok) 0 ${okPct}%, var(--danger) ${okPct}% ${okPct + failPct}%, var(--bg-sunken) ${okPct + failPct}% 100%)`
}

function renderRingBody(
  known: number,
  failed: number,
  left: number,
  total: number
): HTMLElement {
  const done = known + failed
  return el("div", { class: "day-card-body day-card-ring" }, [
    el(
      "div",
      {
        class: "day-donut",
        style: { background: ringGradient(known, failed, Math.max(total, 1)) }
      },
      el("div", { class: "day-donut-inner" }, [
        el("div", { class: "day-donut-num" }, String(done)),
        el("div", { class: "day-donut-of" }, `из ${Math.max(total, done)}`)
      ])
    ),
    el("div", { class: "day-legend" }, [
      el("div", { class: "day-legend-row" }, [
        el("span", { class: "day-swatch day-swatch-ok" }),
        "Знаю",
        el("span", { class: "day-legend-val day-legend-ok" }, String(known))
      ]),
      el("div", { class: "day-legend-row" }, [
        el("span", { class: "day-swatch day-swatch-fail" }),
        "Не знаю",
        el("span", { class: "day-legend-val day-legend-fail" }, String(failed))
      ]),
      el("div", { class: "day-legend-row day-legend-left" }, [
        el("span", { class: "day-swatch day-swatch-left" }),
        "Осталось",
        el("span", { class: "day-legend-val" }, String(left))
      ])
    ])
  ])
}

function renderWeekBody(): HTMLElement {
  const bars = weekBarsData()
  const max = Math.max(1, ...bars.map((b) => b.known + b.failed))
  const scale = 64 / max

  const cols = bars.map((b) => {
    const total = b.known + b.failed
    const empty = total === 0
    const okH = empty ? 0 : Math.max(4, Math.round(b.known * scale))
    const failH = empty ? 0 : Math.max(3, Math.round(b.failed * scale * 0.6))
    return el("div", { class: "week-bar-col" }, [
      empty
        ? el("div", { class: "week-bar-empty" })
        : el("div", { class: "week-bar-stack" }, [
            el("div", {
              class: "week-bar-fail",
              style: { height: failH + "px" }
            }),
            el("div", {
              class: "week-bar-ok",
              style: { height: okH + "px" }
            })
          ]),
      el(
        "span",
        { class: "week-bar-label" + (b.isToday ? " is-today" : "") },
        b.label
      )
    ])
  })

  return el("div", { class: "day-card-body day-card-week" }, [
    el("div", { class: "week-bars" }, cols),
    el("div", { class: "week-legend" }, [
      el("span", null, [
        el("span", { class: "day-swatch day-swatch-ok-sm" }),
        "знаю"
      ]),
      el("span", null, [
        el("span", { class: "day-swatch day-swatch-fail-sm" }),
        "не знаю"
      ])
    ])
  ])
}

export function homeDayCard(leftToday: number, onContinue: () => void): HTMLElement {
  const data = loadActivity()
  const today = data.days[dayKey()]
  const { known, failed } = dayKnownFailed(today)
  const total = known + failed + leftToday
  const done = known + failed
  const accuracy = done > 0 ? Math.round((known / done) * 100) : 0

  let view = getHeroView()
  const card = el("div", { class: "day-card" })

  const title = el("div", { class: "day-card-title" }, "Повторение дня")
  const subtitle = el(
    "div",
    { class: "day-card-sub" },
    view === "ring" ? "результаты сегодня" : "активность за неделю"
  )
  const toggleBtn = el(
    "button",
    {
      type: "button",
      class: "day-card-toggle",
      title: view === "ring" ? "Показать неделю" : "Показать сегодня"
    },
    view === "ring" ? "→" : "←"
  ) as HTMLButtonElement

  const bodySlot = el("div", { class: "day-card-body-slot" })

  function paintHead() {
    const isWeek = view === "week"
    card.classList.toggle("day-card--week", isWeek)
    if (isWeek) {
      title.textContent = "Активность за неделю"
      title.hidden = false
      subtitle.textContent = "статистика"
      subtitle.classList.remove("day-card-sub--as-title")
    } else {
      title.textContent = "Повторение дня"
      title.hidden = false
      subtitle.textContent = "результаты сегодня"
      subtitle.classList.remove("day-card-sub--as-title")
    }
    toggleBtn.textContent = isWeek ? "←" : "→"
    toggleBtn.title = isWeek ? "Показать сегодня" : "Показать неделю"
  }

  function paintBody() {
    bodySlot.replaceChildren(
      view === "ring" ? renderRingBody(known, failed, leftToday, total) : renderWeekBody()
    )
    paintHead()
  }

  toggleBtn.addEventListener("click", () => {
    view = view === "ring" ? "week" : "ring"
    setHeroView(view)
    paintBody()
  })

  paintBody()

  const ctaLabel = leftToday > 0 ? "Продолжить" : "Повторить"
  const continueBtn = el(
    "button",
    {
      type: "button",
      class: "day-continue",
      onclick: () => onContinue()
    },
    ctaLabel
  )
  const footerKids: HTMLElement[] = []
  if (done > 0) {
    footerKids.push(
      el("span", { class: "day-accuracy" }, `точность ${accuracy}%`)
    )
  }
  footerKids.push(continueBtn)
  const footer = el(
    "div",
    { class: "day-card-footer" + (done > 0 ? "" : " day-card-footer--no-acc") },
    footerKids
  )

  card.append(
    el("div", { class: "day-card-head" }, [
      el("div", { class: "day-card-titles" }, [title, subtitle]),
      toggleBtn
    ]),
    bodySlot,
    footer
  )

  return card
}
