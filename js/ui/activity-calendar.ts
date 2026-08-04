import { el } from "./ui.js"
import { t, tp, localeTag } from "../lib/i18n.js"
import {
  loadActivity,
  calcVisitStreak,
  getMonthGrid,
  dayKey,
  dayHeatLevel,
  monthName,
  weekdayNamesMonFirst
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
    weekdayNamesMonFirst().map((w) => el("div", null, w))
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
    const name = monthName(viewMonth, viewYear)
    const showYear = viewYear !== now.getFullYear()
    monthLabel.textContent = showYear ? `${name} ${viewYear}` : name
    grid.replaceChildren()
    getMonthGrid(viewYear, viewMonth).forEach((cell) => {
      if (cell.outside) {
        grid.append(el("div", { class: "home-cal-day is-outside" }))
        return
      }
      const info = data.days[cell.key]
      const reviews = info?.reviews || 0
      const heat = dayHeatLevel(reviews)
      const dayNum = cell.day ?? 0
      const tip =
        reviews > 0
          ? t("home.cal.dayTipReviews", {
              day: dayNum,
              month: name,
              n: reviews,
              cards: tp("common.card", reviews)
            })
          : t("home.cal.dayTip", { day: dayNum, month: name })
      const cls = ["home-cal-day", `heat-${heat}`]
      if (cell.key === todayK) cls.push("is-today")
      grid.append(el("div", { class: cls.join(" "), title: tip }, String(dayNum)))
    })
    grid.setAttribute(
      "aria-label",
      new Intl.DateTimeFormat(localeTag(), { month: "long", year: "numeric" }).format(
        new Date(viewYear, viewMonth, 1)
      )
    )
    nextBtn.disabled = isCurrentOrFutureMonth(viewYear, viewMonth, now)
  }

  prevBtn.addEventListener("click", () => {
    ;({ year: viewYear, month: viewMonth } = shiftMonth(viewYear, viewMonth, -1))
    renderMonth()
  })
  nextBtn.addEventListener("click", () => {
    if (isCurrentOrFutureMonth(viewYear, viewMonth, now)) return
    ;({ year: viewYear, month: viewMonth } = shiftMonth(viewYear, viewMonth, 1))
    renderMonth()
  })

  const toggleBtn = el(
    "button",
    {
      type: "button",
      class: "streak-cal-toggle",
      "aria-expanded": "false",
      "aria-label": t("home.cal.expand")
    },
    [
      el("span", { class: "streak-cal-num" }, String(streak)),
      el("span", { class: "streak-cal-label" }, tp("common.day", streak)),
      el("span", { class: "streak-cal-chevron", "aria-hidden": "true" })
    ]
  ) as HTMLButtonElement

  const head = el("div", { class: "streak-cal-head" }, [toggleBtn, monthLabel, navs])

  const expand = el("div", { class: "streak-cal-expand", id: "streak-cal-expand" }, [
    weekdays,
    grid,
    el("div", { class: "home-cal-legend" }, [
      el("span", null, [
        el("span", { class: "home-cal-legend-dot", style: { background: "var(--bg-sunken)" } }),
        "Меньше",
      ]),
      el("span", null, [
        el("span", { class: "home-cal-legend-dot", style: { background: "var(--c-petrol)", opacity: ".4" } }),
        "",
      ]),
      el("span", null, [
        el("span", { class: "home-cal-legend-dot", style: { background: "var(--c-petrol)", opacity: ".7" } }),
        "",
      ]),
      el("span", null, [
        el("span", { class: "home-cal-legend-dot", style: { background: "var(--accent)" } }),
        "Больше",
      ]),
    ]),
  ])
  toggleBtn.setAttribute("aria-controls", "streak-cal-expand")
  const card = el("div", { class: "streak-cal-card streak-cal-collapsible" }, [head, expand])

  let open = false
  function isMobile(): boolean {
    return window.matchMedia("(max-width: 719px)").matches
  }

  function toggleOpen() {
    if (!isMobile()) return
    open = !open
    card.classList.toggle("is-open", open)
    toggleBtn.setAttribute("aria-expanded", String(open))
    toggleBtn.setAttribute(
      "aria-label",
      open ? t("home.cal.collapse") : t("home.cal.expand")
    )
  }

  toggleBtn.addEventListener("click", () => toggleOpen())

  renderMonth()
  return card
}

export { shiftMonth, isCurrentOrFutureMonth }
