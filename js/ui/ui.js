// ============================================================
// КАР-точки — маленькие помощники интерфейса
// ============================================================

export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  if (children !== undefined && children !== null) {
    (Array.isArray(children) ? children : [children]).forEach(ch => {
      if (ch === null || ch === undefined || ch === false) return;
      node.appendChild(typeof ch === 'string' || typeof ch === 'number' ? document.createTextNode(String(ch)) : ch);
    });
  }
  return node;
}

export function toast(msg, type) {
  const root = document.getElementById('toasts');
  const t = el('div', { class: 'toast ' + (type || '') }, msg);
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 350);
  }, 2600);
}

export function modal(content, opts) {
  opts = opts || {};
  const root = document.getElementById('modalRoot');
  const prevFocus = document.activeElement;
  const box = el('div', {
    class: 'modal-box' + (opts.wide ? ' wide' : ''),
    role: 'dialog', 'aria-modal': 'true', tabindex: '-1',
  }, content);
  const overlay = el('div', { class: 'modal-overlay' }, box);

  const focusableSel = 'button, [href], input, textarea, select, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
  const focusables = () => Array.from(box.querySelectorAll(focusableSel))
    .filter(n => !n.disabled && n.offsetParent !== null);

  function close() {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 260);
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) { e.preventDefault(); box.focus(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  }
  overlay.addEventListener('click', e => { if (e.target === overlay && !opts.sticky) close(); });
  document.addEventListener('keydown', onKey);
  root.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add('open');
    const f = focusables();
    (f[0] || box).focus({ preventScroll: true });
  }));
  return { close, box };
}

export function confirmDialog(title, text, okLabel, danger, icon) {
  return new Promise(resolve => {
    let m;
    const content = el('div', null, [
      icon ? el('div', { class: 'modal-illus' }, icon) : null,
      el('h3', { class: 'modal-title' }, title),
      text ? el('p', { class: 'modal-text' }, text) : null,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => { m.close(); resolve(false); } }, 'Отмена'),
        el('button', {
          class: 'btn ' + (danger ? 'danger' : 'primary'),
          onclick: () => { m.close(); resolve(true); },
        }, okLabel || 'Ок'),
      ]),
    ]);
    m = modal(content);
  });
}

export function spinner(size) {
  return el('div', { class: 'spinner', style: size ? { width: size + 'px', height: size + 'px' } : null });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function plural(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return few;
  return many;
}

function safeHref(href) {
  href = String(href || '').trim();
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (/^[^:]*$/.test(href)) return null;
  return null;
}

export function sanitizeRich(html) {
  const doc = new DOMParser().parseFromString('<div>' + String(html || '') + '</div>', 'text/html');
  function clean(node) {
    const out = [];
    node.childNodes.forEach(ch => {
      if (ch.nodeType === Node.TEXT_NODE) {
        out.push(escapeHtml(ch.textContent));
      } else if (ch.nodeType === Node.ELEMENT_NODE) {
        const tag = ch.tagName;
        if (tag === 'DIV' || tag === 'P') {
          out.push(clean(ch));
          out.push('<br>');
        } else if (tag === 'BR') {
          out.push('<br>');
        } else if (tag === 'B' || tag === 'STRONG') {
          out.push('<b>' + clean(ch) + '</b>');
        } else if (tag === 'I' || tag === 'EM') {
          out.push('<i>' + clean(ch) + '</i>');
        } else if (tag === 'A') {
          const href = safeHref(ch.getAttribute('href'));
          if (href) out.push('<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + clean(ch) + '</a>');
          else out.push(clean(ch));
        } else {
          out.push(clean(ch));
        }
      }
    });
    return out.join('');
  }
  let result = clean(doc.body.firstChild);
  result = result.replace(/(<br>)+$/g, '');
  return result;
}

export function stripHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export const CROW_SVG = '<svg viewBox="0 0 256 256" aria-hidden="true"><g fill="currentColor"><circle cx="112" cy="102" r="54"/><path d="M 152 84 Q 196 88 220 101 Q 196 114 152 120 Q 162 101 152 84 Z"/><circle cx="124" cy="88" r="10" fill="var(--bg)"/><circle cx="127" cy="86" r="4.5"/><circle cx="76" cy="196" r="13"/><circle cx="120" cy="196" r="13" opacity="0.62"/><circle cx="164" cy="196" r="13" opacity="0.3"/></g></svg>';
