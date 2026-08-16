import { store } from "../../core/state.js"
import { el, spinner, toast } from "../../ui/ui.js"
import type { ElChild } from "../../ui/ui.js"
import { ICONS } from "../../ui/constants.js"
import {
  crowBox,
  featherIcon,
  newBudget,
  reviewsBudget,
  reviewsTodayCount,
  shuffle,
  svgNode,
  trophyBox
} from "../../ui/helpers.js"
import { shell, offlineBanner, refreshDueBadge } from "../../ui/shell.js"
import { backBtn, nav } from "../../ui/navigation.js"
import {
  studyModeLabel,
  resolveStudyMode,
  promptSideLabel,
  consumeSessionPromptSide,
  getLastPromptSide,
  consumeSessionCramLimit,
  getLastCramLimit
} from "../../lib/study-modes.js"
import { t, tp } from "../../lib/i18n.js"
import * as SRS from "../../lib/srs.js"
import { studyModePicker } from "./mode-picker.js"
import { runReviewSession, type ReviewSessionContext, type ReviewMode } from "./session.js"
import { computeShakiness, orderByShakiness } from "../../lib/shaky.js"
import { getAllReviews } from "../../lib/review-log.js"
import { calcVisitStreak, loadActivity } from "../../lib/activity.js"
import type { Folder } from "../../data/types.js"

let reviewSession = 0

/**
 * Поднять «шаткие» карточки в начало очереди. Журнал — не критичный
 * источник: если он пуст или недоступен, порядок остаётся прежним.
 */
async function orderQueueByShakiness<T extends { id?: string }>(queue: T[]): Promise<T[]> {
  try {
    const entries = await getAllReviews()
    if (!entries.length) return queue
    return orderByShakiness(queue, computeShakiness(entries))
  } catch (e) {
    console.warn("[kar] shaky ordering skipped:", e)
    return queue
  }
}

interface ReviewOpts {
  cram?: boolean
  mode?: string
  cramLimit?: number
  review?: boolean
  fromLesson?: boolean
  onSaved?: unknown
  onDeleted?: unknown
  box_id?: string | null
  noteId?: string | null
}

function shellEmptyReview(children: ElChild[]) {
  shell(
    "review",
    el("div", { class: "review-wrap review-wrap--done review-wrap--empty" }, [
      el("div", { class: "review-done-slot" }, [
        el("div", { class: "review-done review-done--card" }, children)
      ])
    ])
  )
}

export async function renderReview(folderId: string | null, opts: ReviewOpts = {}) {
  const session = ++reviewSession
  const noteId = opts.noteId ? String(opts.noteId) : null
  // Глобальный cram (без папки) — «Продолжить заниматься» на пустом экране.
  const cram = !!opts.cram
  const cramPromptSide = cram ? consumeSessionPromptSide() || getLastPromptSide() : null

  shell(
    "review",
    el("div", { class: "review-wrap" }, el("div", { class: "center-pad" }, spinner(30)))
  )

  await refreshDueBadge()
  if (session !== reviewSession) return

  const mode = resolveStudyMode(opts.mode ?? "") as ReviewMode
  const cramLimit = cram
    ? (opts.cramLimit ?? 0) > 0
      ? opts.cramLimit
      : (consumeSessionCramLimit() ?? getLastCramLimit())
    : null
  const algo = store.settings.algo
  const now = Date.now()
  const budget = newBudget()
  const folder = folderId ? store.folders.find((f: Folder) => f.id === folderId) : null
  const noteCtx = noteId ? await store.getNote(noteId).catch(() => null) : null
  if (noteId && !noteCtx) {
    toast(t("notes.toast.missing"), "error")
    nav("#notes")
    return
  }

  if (algo === "fsrs") {
    const { preloadFsrs, configureFsrs, fsrsConfigFromSettings } = await import("../../lib/srs.js")
    await preloadFsrs()
    configureFsrs(fsrsConfigFromSettings(store.settings))
  }
  if (session !== reviewSession) return

  let queue
  let dayLimitHit = false
  if (cram) {
    const limit: number | null = (cramLimit ?? 0) > 0 ? (cramLimit as number) : null
    queue =
      typeof store.getCramCards === "function"
        ? await store.getCramCards(folderId || null, limit)
        : shuffle([...(await store.getFolderCards(folderId || ""))]).slice(0, limit || undefined)
  } else {
    const dayLeft = reviewsBudget()
    if (dayLeft <= 0 && !noteId) {
      dayLimitHit = true
      queue = []
    } else if (noteId) {
      // Note-scope: только карточки, связанные с этой заметкой. Без дневных лимитов —
      // это точечное повторение концепта.
      const linked = await store.getNoteCards(noteId)
      const dueCards: typeof linked = []
      const newCards: typeof linked = []
      for (const c of linked) {
        if (SRS.isDue(c, algo, now)) dueCards.push(c)
        else if (SRS.isNew(c, algo)) newCards.push(c)
      }
      queue = shuffle(dueCards.concat(newCards))
    } else {
      const { due: dueCards, fresh: newCards } = await store.getReviewCards(
        folderId || null,
        algo,
        budget,
        now
      )
      // Просроченное имеет приоритет над новым. Раньше здесь был общий
      // shuffle(due + new).slice(dayLeft): при 40 просроченных, 20 новых и
      // лимите 50 около семи ПРОСРОЧЕННЫХ карточек выбрасывалось случайно в
      // пользу новых — то есть лимит съедали как раз те карточки, которые
      // можно было бы и отложить. Сначала берём due, новыми добиваем остаток;
      // финальный shuffle нужен, чтобы новые не шли одним блоком в конце.
      const dueSlice = shuffle(dueCards).slice(0, dayLeft)
      const newSlice = shuffle(newCards).slice(0, Math.max(0, dayLeft - dueSlice.length))
      queue = shuffle(dueSlice.concat(newSlice))
      // «Шаткие» — те, что чаще проваливались и отвечались медленнее своей
      // же нормы, — идут первыми: они ближе всех к забыванию, внимание в
      // начале сессии свежее, а если сессию бросят на середине, сделанной
      // окажется самая ценная часть. Расписание при этом не меняется.
      queue = await orderQueueByShakiness(queue)
    }
  }

  if (session !== reviewSession) return

  if (!queue.length) {
    if (noteId) {
      const title = (noteCtx && (noteCtx.title || "").trim()) || t("notes.untitled")
      shellEmptyReview([
        trophyBox(),
        el("h2", null, t("review.note.emptyTitle")),
        el("p", null, t("review.note.emptyText", { title })),
        el("div", { class: "review-done-actions" }, [
          el(
            "button",
            {
              class: "btn primary big",
              onclick: () => nav("#note/" + noteId)
            },
            t("review.note.back")
          )
        ])
      ])
      return
    }
    if (dayLimitHit) {
      // Норма дня — достижение, а не отказ. Переедание уроков у Duolingo
      // оказалось предиктором ухода, а разрешённая остановка, наоборот,
      // повышает возврат. Поэтому здесь празднуем выполненную норму, а
      // «позаниматься сверх» предлагаем закреплением: оно не трогает ни
      // расписание, ни дневной счётчик.
      const limit = store.settings.reviewsPerDay || 50
      const done = reviewsTodayCount()
      const streak = calcVisitStreak(loadActivity())
      const poolCount = folderId ? await store.countCards(folderId) : await store.countCards(null)
      shellEmptyReview([
        trophyBox(),
        el("h2", null, t("review.goal.title")),
        el("p", { class: "review-done-sub" }, t("review.goal.sub")),
        el("div", { class: "review-done-stats" }, [
          el("div", { class: "review-done-stat is-ok" }, [
            el("div", { class: "review-done-stat-val" }, String(done)),
            el("div", { class: "review-done-stat-lab" }, t("review.goal.statDone"))
          ]),
          el("div", { class: "review-done-stat" }, [
            el("div", { class: "review-done-stat-val" }, String(limit)),
            el("div", { class: "review-done-stat-lab" }, t("review.goal.statLimit"))
          ]),
          streak > 0
            ? el("div", { class: "review-done-stat is-streak" }, [
                el("div", { class: "review-done-stat-val" }, String(streak)),
                el("div", { class: "review-done-stat-lab" }, tp("common.day", streak))
              ])
            : null
        ]),
        el("div", { class: "review-done-actions" }, [
          el(
            "button",
            {
              class: "btn accent big",
              onclick: () => nav(folderId ? "#folder/" + folderId : "#home")
            },
            folderId ? t("review.empty.toFolder") : t("review.empty.toFolders")
          ),
          poolCount
            ? el(
                "button",
                {
                  class: "btn big",
                  onclick: () => studyModePicker({ folderId, cram: true })
                },
                t("review.goal.extra")
              )
            : null
        ]),
        el(
          "button",
          {
            class: "link-btn review-goal-settings",
            onclick: () => nav("#settings")
          },
          t("review.goal.changeLimit")
        )
      ])
      return
    }
    const poolCount = folderId ? await store.countCards(folderId) : await store.countCards(null)
    shellEmptyReview([
      poolCount ? trophyBox() : crowBox("crow"),
      el("h2", null, poolCount ? t("review.empty.doneTitle") : t("review.empty.blankTitle")),
      el("p", null, poolCount ? t("review.empty.doneText") : t("review.empty.blankText")),
      el("div", { class: "review-done-actions" }, [
        poolCount
          ? el(
              "button",
              {
                class: "btn accent big review-done-again",
                onclick: () => studyModePicker({ folderId, cram: true })
              },
              t("review.empty.continue")
            )
          : null,
        el(
          "button",
          {
            class: "btn primary big review-done-home",
            onclick: () => nav(folderId ? "#folder/" + folderId : "#home")
          },
          folderId ? t("review.empty.toFolder") : t("review.empty.toFolders")
        )
      ])
    ])
    return
  }

  const sessionTotal = queue.length
  const modeLabel = studyModeLabel(mode)
  const cardsWord = tp("common.card", sessionTotal)
  const intro = cram
    ? el("p", { class: "review-intro review-intro-cram" }, [
        t("review.intro.cram", {
          side: promptSideLabel(cramPromptSide ?? "front"),
          mode: modeLabel,
          n: sessionTotal,
          cards: cardsWord
        }),
        folder ? t("review.intro.cramFrom", { name: folder.name }) : ""
      ])
    : noteId
      ? el("p", { class: "review-intro review-intro-note" }, [
          t("review.intro.note", {
            n: sessionTotal,
            cards: cardsWord,
            title: (noteCtx && (noteCtx.title || "").trim()) || t("notes.untitled")
          })
        ])
      : el("p", { class: "review-intro" }, [
          t("review.intro.regular", {
            mode: modeLabel,
            n: sessionTotal,
            cards: cardsWord
          }),
          folder ? t("review.intro.folder", { name: folder.name }) : ""
        ])

  const segs = el("div", { class: "progress-segs" }, undefined)
  for (let i = 0; i < sessionTotal; i++) {
    segs.append(el("div", { class: "progress-seg" + (i === 0 ? " is-current" : "") }))
  }
  const counter = el("span", { class: "review-count" }, "")
  const speakBtn = el(
    "button",
    {
      class: "icon-btn",
      title: t("review.toolbar.speak"),
      "aria-label": t("review.toolbar.speak")
    },
    svgNode(ICONS.speaker)
  )
  const editBtn = el(
    "button",
    {
      class: "icon-btn",
      title: t("review.toolbar.edit"),
      "aria-label": t("review.toolbar.edit")
    },
    featherIcon()
  )
  const stage = el("div", null, undefined)
  const wrap = el("div", { class: "review-wrap" }, undefined)
  const top = el("div", { class: "review-top" }, [
    backBtn(noteId ? "#note/" + noteId : folderId ? "#folder/" + folderId : "#home"),
    segs,
    counter,
    speakBtn,
    editBtn
  ])
  wrap.append(top, stage)

  const ctx: ReviewSessionContext = {
    folderId: folderId ?? undefined,
    noteId: noteId ?? undefined,
    mode,
    cram,
    cramPromptSide: cramPromptSide ?? undefined,
    algo,
    queue,
    sessionTotal,
    total: sessionTotal,
    done: 0,
    answered: 0,
    sessionFirstTry: new Set<string>(),
    currentIsNew: false,
    gradesVisible: false,
    pendingUndo: null,
    undoToastDismiss: null,
    undoHoldUntilFlip: false,
    showNextTimer: null,
    grading: false,
    currentSwipeWrap: null,
    currentBox: null,
    currentDestroy: null,
    stats: { attempted: 0, firstTryOk: 0, known: 0, failed: 0 },
    reshowAfterEdit: undefined,
    bar: segs,
    counter,
    speakBtn,
    editBtn,
    stage,
    showNext: () => {},
    trackFlipFirstTry: () => false,
    updateBar: () => {}
  }

  shell("review", el("div", null, [offlineBanner(), intro, wrap]), null, { hideTabbar: true })

  runReviewSession(ctx)
}
