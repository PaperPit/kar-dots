function isTextEntryTarget(node) {
  if (!node || !(node instanceof Element)) return false;
  if (node.closest('.modal-overlay')) return true;
  const tag = node.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (node.isContentEditable) return true;
  return !!node.closest('[contenteditable="true"]');
}

export function isSpaceKey(e) {
  return e.key === ' ' || e.code === 'Space';
}

/** Пробел запускает запись только когда не активирует другую кнопку. */
export function shouldStartVoiceFromSpace(e, box) {
  if (!box || !isSpaceKey(e) || e.repeat) return false;
  if (typeof document !== 'undefined' && !document.body.contains(box)) return false;

  const target = e.target instanceof Element ? e.target : null;
  const active = typeof document !== 'undefined' && document.activeElement instanceof Element
    ? document.activeElement
    : null;

  if (isTextEntryTarget(target) || isTextEntryTarget(active)) return false;

  const hit = target || active;
  if (hit?.closest('.icon-btn, .nav, .nav-btn, .tab-btn, .brand')) return false;

  const foreignBtn = hit?.closest('button:not(.study-mic-btn), a[href], [role="button"]:not(.study-mic-btn)');
  if (foreignBtn && !box.contains(foreignBtn)) return false;

  const voiceBtn = hit?.closest('button:not(.study-mic-btn), a[href]');
  if (voiceBtn && box.contains(voiceBtn)) return false;

  const inVoice = box.contains(active)
    || active === document.body
    || active === document.documentElement
    || box.contains(target);

  return inVoice || !active?.closest('button, a[href], input, textarea, select, [contenteditable="true"]');
}
