import { store } from "../../core/state.js"
import { el, spinner, toast } from "../../ui/ui.js"
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
import type { Folder } from "../../data/types.js"

let reviewSession = 0

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

export async function renderReview(folderId: string | null, opts: ReviewOpts = {}) {
  const session = ++reviewSession
  const noteId = opts.noteId ? String(opts.noteId) : null
  const cram = !!opts.cram && !!folderId
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
        ? await store.getCramCards(folderId, limit)
        : shuffle([...(await store.getFolderCards(folderId))]).slice(0, limit || undefined)
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
    }
  }

  if (session !== reviewSession) return

  if (!queue.length) {
    if (noteId) {
      const title = (noteCtx && (noteCtx.title || "").trim()) || t("notes.untitled")
      shell(
        "review",
        el("div", { class: "review-done" }, [
          trophyBox(),
          el("h2", null, t("review.note.emptyTitle")),
          el("p", null, t("review.note.emptyText", { title })),
          el(
            "button",
            {
              class: "btn primary big",
              onclick: () => nav("#note/" + noteId)
            },
            t("review.note.back")
          )
        ])
      )
      return
    }
    if (dayLimitHit) {
      const limit = store.settings.reviewsPerDay || 50
      const done = reviewsTodayCount()
      shell(
        "review",
        el("div", { class: "review-done" }, [
          trophyBox(),
          el("h2", null, t("review.empty.limitTitle")),
          el(
            "p",
            null,
            t("review.empty.limitText", {
              done,
              grades: tp("common.grade", done),
              limit
            })
          ),
          el(
            "button",
            {
              class: "btn primary big",
              onclick: () => nav("#settings")
            },
            t("review.empty.toSettings")
          ),
          el(
            "button",
            {
              class: "btn big",
              onclick: () => nav(folderId ? "#folder/" + folderId : "#home")
            },
            folderId ? t("review.empty.toFolder") : t("review.empty.toFolders")
          )
        ])
      )
      return
    }
    const poolCount = folderId ? await store.countCards(folderId) : await store.countCards(null)
    shell(
      "review",
      el("div", { class: "review-done" }, [
        poolCount ? trophyBox() : crowBox("crow"),
        el("h2", null, poolCount ? t("review.empty.doneTitle") : t("review.empty.blankTitle")),
        el("p", null, poolCount ? t("review.empty.doneText") : t("review.empty.blankText")),
        poolCount && folderId && !cram
          ? el(
              "button",
              {
                class: "btn accent big",
                onclick: () => studyModePicker({ folderId, cram: true })
              },
              t("review.empty.cramFolder")
            )
          : null,
        el(
          "button",
          {
            class: "btn primary big",
            onclick: () => nav(folderId ? "#folder/" + folderId : "#home")
          },
          folderId ? t("review.empty.toFolder") : t("review.empty.toFolders")
        )
      ])
    )
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
