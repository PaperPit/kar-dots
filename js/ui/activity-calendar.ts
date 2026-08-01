import { el, plural } from "./ui.js"
import { store } from "../core/state.js"
import { t } from "../lib/i18n.js"
import {
  loadActivity,
  calcVisitStreak,
  getMonthGrid,
  dayKey,
  dayHeatLevel,
  MONTH_NAMES,
  WEEKDAY_NAMES
} from "../lib/activity.js"

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

function isCurrentOrFutureMonth(year: number, month: number, now = new Date()): boolean {
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())
}

function streakRing(streak: number, sm?: boolean): HTMLElement {
  const ringDays = Math.max(1, Number(store?.settings?.streakRingDays) || 21)
  const deg = streak <= 0 ? 0 : Math.min(360, (streak / ringDays) * 360)
  return el(
    "div",
    {
      class: "streak-ring" + (sm ? " streak-ring-sm" : ""),
      style: { "--ring-deg": deg + "deg" }
    },
    el("img", { class: "streak-cup", src: "icons/cup.svg", alt: "", draggable: "false" })
  )
}

export function activityPanel(opts: { sidebar?: boolean; compact?: boolean } = {}): HTMLElement {
  const { sidebar = false, compact = false } = opts
  const mod = sidebar ? " sidebar" : compact ? " compact" : ""
  const wrap = el("div", { class: "activity-panel" + mod })
  let viewYear = new Date().getFullYear()
  let viewMonth = new Date().getMonth()
  const todayK = dayKey()

  function render() {
    const data = loadActivity()
    const streak = calcVisitStreak(data)
    wrap.innerHTML = ""

    const streakRow = el("div", { class: "streak-row" }, [
      streakRing(streak),
      el("div", { class: "streak-text" }, [
        el("div", { class: "streak-num" }, String(streak)),
        el(
          "div",
          { class: "streak-label" },
          plural(streak, "день подряд", "дня подряд", "дней подряд")
        ),
        compact || sidebar
          ? null
          : el("div", { class: "streak-hint muted" }, "Заходите каждый день — серия растёт")
      ])
    ])

    const nav = el("div", { class: "cal-nav" }, [
      el(
        "button",
        {
          class: "icon-btn cal-arrow",
          title: "Предыдущий месяц",
          onclick: () => {
            if (viewMonth === 0) {
              viewYear--
              viewMonth = 11
            } else viewMonth--
            render()
          }
        },
        "‹"
      ),
      el("span", { class: "cal-title" }, `${MONTH_NAMES[viewMonth]} ${viewYear}`),
      el(
        "button",
        {
          class: "icon-btn cal-arrow",
          title: "Следующий месяц",
          onclick: () => {
            if (viewMonth === 11) {
              viewYear++
              viewMonth = 0
            } else viewMonth++
            render()
          }
        },
        "›"
      )
    ])

    const weekdays = el(
      "div",
      { class: "cal-weekdays" },
      WEEKDAY_NAMES.map((w) => el("span", null, w))
    )

    const grid = el("div", { class: "cal-grid" })
    getMonthGrid(viewYear, viewMonth).forEach((cell) => {
      const info = data.days[cell.key]
      const cls = ["cal-day"]
      if (cell.outside) cls.push("outside")
      if (cell.key === todayK) cls.push("today")
      if (info?.visit) cls.push("visit")
      if (info?.reviews) cls.push("review")
      grid.append(el("div", { class: cls.join(" "), title: cellTitle(info) }, String(cell.day)))
    })

    wrap.append(streakRow, nav, weekdays, grid)
  }

  function cellTitle(info: { visit?: boolean; reviews?: number } | undefined) {
    if (!info) return ""
    const parts = []
    if (info.visit) parts.push("Заход в приложение")
    if (info.reviews) parts.push(`Повторено карточек: ${info.reviews}`)
    return parts.join(". ")
  }

  render()
  return wrap
}

/** Календарь на главной: на мобиле — компактная полоска с раскрытием, на десктопе — боковая панель. */
export function homeCalendarWidget(place: string): HTMLElement {
  const aside = el("aside", {
    class: "home-sidebar home-sidebar-" + place + " home-sidebar-collapsible"
  })

  let open = false
  const panel = activityPanel({ sidebar: true })
  const expand = el("div", { class: "home-sidebar-expand" }, panel)

  const toggle = el("button", {
    type: "button",
    class: "home-sidebar-toggle",
    "aria-expanded": "false",
    "aria-label": "Открыть календарь активности"
  })

  function refreshStrip() {
    const data = loadActivity()
    const streak = calcVisitStreak(data)
    const now = new Date()
    const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
    toggle.replaceChildren(
      streakRing(streak, true),
      el("div", { class: "home-sidebar-strip-text" }, [
        el(
          "span",
          { class: "home-sidebar-strip-streak" },
          `${streak} ${plural(streak, "день", "дня", "дней")} подряд`
        ),
        el("span", { class: "home-sidebar-strip-month" }, monthLabel)
      ]),
      el("span", { class: "home-sidebar-chevron", "aria-hidden": "true" })
    )
  }

  toggle.addEventListener("click", () => {
    open = !open
    aside.classList.toggle("is-open", open)
    toggle.setAttribute("aria-expanded", String(open))
    toggle.setAttribute("aria-label", open ? "Свернуть календарь" : "Открыть календарь активности")
  })

  aside.append(toggle, expand)
  refreshStrip()
  return aside
}

/** Inline-карточка серии + календарь месяца (редизайн 1b).
 *  На узких экранах — сверху, свёрнута до стрика, по тапу раскрывается.
 *  Месяц листается стрелками в шапке (между стриком и кубком); вперёд — не дальше текущего. */
export function homeStreakCalendarCard(): HTMLElement {
  const data = loadActivity()
  const streak = calcVisitStreak(data)
  const now = new Date()
  let viewYear = now.getFullYear()
  let viewMonth = now.getMonth()
  const todayK = dayKey(now)

  const weekdays = el(
    "div",
    { class: "home-cal-weekdays" },
    WEEKDAY_NAMES.map((w) => el("div", null, w.toLowerCase()))
  )
  const grid = el("div", { class: "home-cal-grid" })
  const prevBtn = el(
    "button",
    {
      type: "button",
      class: "streak-cal-nav",
      "aria-label": t("home.cal.prevMonth"),
      title: t("home.cal.prevMonth")
    },
    "‹"
  ) as HTMLButtonElement
  const nextBtn = el(
    "button",
    {
      type: "button",
      class: "streak-cal-nav",
      "aria-label": t("home.cal.nextMonth"),
      title: t("home.cal.nextMonth")
    },
    "›"
  ) as HTMLButtonElement
  const navs = el("div", { class: "streak-cal-navs" }, [prevBtn, nextBtn])
  const monthLabel = el("span", { class: "streak-cal-month" })

  function renderMonth() {
    const monthName = (MONTH_NAMES[viewMonth] || "").toLowerCase()
    const showYear = viewYear !== now.getFullYear()
    monthLabel.textContent = showYear ? `${monthName} ${viewYear}` : monthName
    grid.replaceChildren()
    getMonthGrid(viewYear, viewMonth).forEach((cell) => {
      if (cell.outside) {
        grid.append(el("div", { class: "home-cal-day is-outside" }))
        return
      }
      const info = data.days[cell.key]
      const reviews = info?.reviews || 0
      const heat = dayHeatLevel(reviews)
      const tip =
        reviews > 0
          ? `${cell.day} ${monthName} · ${reviews} ${plural(reviews, "карточка", "карточки", "карточек")}`
          : `${cell.day} ${monthName}`
      const cls = ["home-cal-day", `heat-${heat}`]
      if (cell.key === todayK) cls.push("is-today")
      grid.append(el("div", { class: cls.join(" "), title: tip }, String(cell.day)))
    })
    grid.setAttribute("aria-label", `${monthName} ${viewYear}`)
    nextBtn.disabled = isCurrentOrFutureMonth(viewYear, viewMonth, now)
  }

  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation()
    ;({ year: viewYear, month: viewMonth } = shiftMonth(viewYear, viewMonth, -1))
    renderMonth()
  })
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation()
    if (isCurrentOrFutureMonth(viewYear, viewMonth, now)) return
    ;({ year: viewYear, month: viewMonth } = shiftMonth(viewYear, viewMonth, 1))
    renderMonth()
  })

  const head = el(
    "div",
    {
      class: "streak-cal-head",
      role: "button",
      tabindex: "0",
      "aria-expanded": "false",
      "aria-label": "Открыть календарь активности"
    },
    [
      el("span", { class: "streak-cal-num" }, String(streak)),
      el(
        "span",
        { class: "streak-cal-label" },
        plural(streak, "день", "дня", "дней")
      ),
      monthLabel,
      navs,
      el("span", { class: "streak-cal-chevron", "aria-hidden": "true" })
    ]
  )

  const expand = el("div", { class: "streak-cal-expand" }, [weekdays, grid])
  const card = el("div", { class: "streak-cal-card streak-cal-collapsible" }, [head, expand])

  let open = false
  function isMobile(): boolean {
    return window.matchMedia("(max-width: 719px)").matches
  }

  function toggleOpen() {
    if (!isMobile()) return
    open = !open
    card.classList.toggle("is-open", open)
    head.setAttribute("aria-expanded", String(open))
    head.setAttribute(
      "aria-label",
      open ? "Свернуть календарь" : "Открыть календарь активности"
    )
  }

  head.addEventListener("click", (e) => {
    if ((e.target as Element | null)?.closest?.(".streak-cal-navs")) return
    toggleOpen()
  })
  head.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return
    if ((e.target as Element | null)?.closest?.(".streak-cal-navs")) return
    e.preventDefault()
    toggleOpen()
  })

  renderMonth()
  return card
}

export { shiftMonth, isCurrentOrFutureMonth }
