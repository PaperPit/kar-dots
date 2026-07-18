import { el } from "./ui.js"

/**
 * Компактный выбор мелодии: кнопка → выпадающее меню с ▶ и выбором.
 */
interface MelodyOpts {
  label: string
  value: string
  melodies: { id: string; label: string }[]
  onChange: (id: string) => void
  play: (id: string) => void
}

export function melodyPickerField(opts: MelodyOpts): HTMLElement & { destroy: () => void } {
  const getLabel = (id: string) =>
    opts.melodies.find((m) => m.id === id)?.label || opts.melodies[0]?.label || "—"
  let open = false

  const valueEl = el("span", { class: "melody-picker-value" }, getLabel(opts.value))
  const menu = el("div", { class: "melody-picker-menu", role: "listbox", hidden: true })
  const wrap = el("div", { class: "melody-picker-wrap" })

  function close() {
    open = false
    menu.hidden = true
    trigger.setAttribute("aria-expanded", "false")
    wrap.classList.remove("is-open")
  }

  function select(id: string) {
    valueEl.textContent = getLabel(id)
    opts.onChange(id)
    close()
  }

  const trigger = el(
    "button",
    {
      type: "button",
      class: "melody-picker-trigger",
      "aria-haspopup": "listbox",
      "aria-expanded": "false"
    },
    [
      el("span", { class: "melody-picker-lab" }, opts.label),
      valueEl,
      el("span", { class: "melody-picker-chevron", "aria-hidden": "true" }, "▾")
    ]
  )

  opts.melodies.forEach((m) => {
    const playBtn = el(
      "button",
      {
        type: "button",
        class: "melody-picker-play",
        title: "Прослушать",
        "aria-label": `Прослушать ${m.label}`
      },
      "▶"
    )
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      opts.play(m.id)
    })

    const opt = el(
      "button",
      {
        type: "button",
        class: "melody-picker-option" + (m.id === opts.value ? " is-active" : ""),
        role: "option"
      },
      [el("span", { class: "melody-picker-option-label" }, m.label), playBtn]
    )
    opt.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest(".melody-picker-play")) return
      menu.querySelectorAll(".melody-picker-option").forEach((o) => o.classList.remove("is-active"))
      opt.classList.add("is-active")
      select(m.id)
    })
    menu.append(opt)
  })

  trigger.addEventListener("click", (e) => {
    e.stopPropagation()
    if (open) close()
    else {
      open = true
      menu.hidden = false
      trigger.setAttribute("aria-expanded", "true")
      wrap.classList.add("is-open")
    }
  })

  const onDocClick = (e: Event) => {
    if (!(e.target instanceof Node) || !wrap.contains(e.target)) close()
  }
  document.addEventListener("click", onDocClick)

  wrap.append(trigger, menu)

  return Object.assign(wrap, {
    destroy: () => {
      document.removeEventListener("click", onDocClick)
      close()
    }
  })
}
