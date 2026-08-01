import { el, plural } from "./ui.js"
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

/** Inline-карточка серии + календарь месяца.
 *  На узких экранах — сверху, свёрнута до стрика, по тапу раскрывается.
 *  Месяц листается стрелками в шапке; вперёд — не дальше текущего. */
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
