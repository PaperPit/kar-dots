import { el, modal } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';
import { stockMediaKeySummary } from '../../../lib/stock-media-settings.js';
import { cleanGiphyApiKey, cleanPixabayApiKey } from '../../../lib/llm-api-keys.js';
import type { Settings } from '../../../data/types.js';

type KeyProp = 'pixabayApiKey' | 'giphyApiKey';

interface KeyDef {
  prop: KeyProp;
  title: string;
  placeholder: string;
  lead: string;
  helpOpen: string;
  helpHow: string;
  keyNote: string;
  help: { linkText: string; linkHref: string; steps: string[] };
}

function getKeyDefs(): KeyDef[] {
  return [
    {
      prop: 'pixabayApiKey',
      title: t('settings.media.pixabay.title'),
      placeholder: '12345678-abcdef…',
      lead: t('settings.media.pixabay.lead'),
      helpOpen: t('settings.media.helpOpen'),
      helpHow: t('settings.media.helpHow'),
      keyNote: t('settings.media.keyNote'),
      help: {
        linkText: 'pixabay.com/api/docs',
        linkHref: 'https://pixabay.com/api/docs/',
        steps: [
          t('settings.media.pixabay.step1'),
          t('settings.media.pixabay.step2'),
          t('settings.media.pixabay.step3'),
        ],
      },
    },
    {
      prop: 'giphyApiKey',
      title: t('settings.media.giphy.title'),
      placeholder: '…',
      lead: t('settings.media.giphy.lead'),
      helpOpen: t('settings.media.helpOpen'),
      helpHow: t('settings.media.helpHow'),
      keyNote: t('settings.media.keyNote'),
      help: {
        linkText: 'developers.giphy.com',
        linkHref: 'https://developers.giphy.com/dashboard/',
        steps: [
          t('settings.media.giphy.step1'),
          t('settings.media.giphy.step2'),
          t('settings.media.giphy.step3'),
        ],
      },
    },
  ];
}

function validateKey(prop: KeyProp, value: unknown) {
  const v = String(value || '').trim();
  if (!v) return { ok: true, message: '' };
  if (prop === 'pixabayApiKey' && !cleanPixabayApiKey(v)) {
    return { ok: false, message: t('settings.media.invalidPixabay') };
  }
  if (prop === 'giphyApiKey' && !cleanGiphyApiKey(v)) {
    return { ok: false, message: t('settings.media.invalidGiphy') };
  }
  return { ok: true, message: '' };
}

function updateKeyStatus(statusEl: HTMLElement, def: KeyDef, value: unknown) {
  const next = String(value || '').trim();
  if (!next) {
    statusEl.textContent = t('settings.media.statusMissing');
    statusEl.classList.remove('is-set', 'is-invalid');
    return;
  }
  const check = validateKey(def.prop, next);
  if (!check.ok) {
    statusEl.textContent = check.message;
    statusEl.classList.add('is-invalid');
    statusEl.classList.remove('is-set');
    return;
  }
  statusEl.textContent = t('settings.media.statusSaved');
  statusEl.classList.add('is-set');
  statusEl.classList.remove('is-invalid');
}

function buildKeyField(def: KeyDef, s: Settings, save: (patch?: Partial<Settings>) => void) {
  let visible = false;
  const keyInput = el('input', {
    type: 'password',
    class: 'input api-key-input',
    placeholder: def.placeholder,
    autocomplete: 'off',
    spellcheck: false,
    value: s[def.prop] || '',
  }, []) as HTMLInputElement;
  const statusEl = el('span', { class: 'api-key-status' }, '');
  updateKeyStatus(statusEl, def, s[def.prop]);

  const toggleBtn = el('button', {
    type: 'button',
    class: 'btn ghost api-key-toggle',
    onclick: () => {
      visible = !visible;
      keyInput.type = visible ? 'text' : 'password';
      toggleBtn.textContent = visible ? t('common.hide') : t('common.show');
    },
  }, t('common.show')) as HTMLButtonElement;

  function flush() {
    const next = keyInput.value.trim();
    let normalized = next;
    if (def.prop === 'pixabayApiKey') normalized = cleanPixabayApiKey(next) || next;
    else if (def.prop === 'giphyApiKey') normalized = cleanGiphyApiKey(next) || next;
    const check = validateKey(def.prop, normalized);
    updateKeyStatus(statusEl, def, normalized);
    if (!check.ok && normalized) {
      s[def.prop] = normalized;
      save();
      return true;
    }
    if (!check.ok) return false;
    if (normalized === (s[def.prop] || '')) return true;
    s[def.prop] = normalized;
    save();
    return true;
  }

  keyInput.addEventListener('blur', () => { flush(); });
  keyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); keyInput.blur(); }
  });

  const node = el('div', { class: 'api-key-block' }, [
    el('div', { class: 'lab' }, [
      el('b', null, def.title),
      el('span', { class: 'api-key-lead' }, def.lead),
      el('details', { class: 'api-key-help' }, [
        el('summary', null, def.helpHow),
        el('ol', null, [
          el('li', null, [
            def.helpOpen + ' ',
            el('a', { href: def.help.linkHref, target: '_blank', rel: 'noopener noreferrer' }, def.help.linkText),
            '.',
          ]),
          ...def.help.steps.map((step: string) => el('li', null, step)),
        ]),
        el('p', { class: 'muted api-key-note' }, def.keyNote),
      ]),
    ]),
    el('div', { class: 'api-key-field' }, [keyInput, toggleBtn, statusEl]),
  ]);

  return { node, flush };
}

function openKeysModal(s: Settings, save: (patch?: Partial<Settings>) => void, onClose: () => void) {
  const fields = getKeyDefs().map(def => buildKeyField(def, s, save));
  const m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, t('settings.media.modalTitle')),
    el('p', { class: 'modal-text muted' }, t('settings.media.modalIntro')),
    el('div', { class: 'integrations-keys-modal' }, fields.map(f => f.node)),
    el('div', { class: 'modal-actions' }, [
      el('button', {
        class: 'btn primary',
        onclick: () => { if (fields.every(f => f.flush())) m.close(); },
      }, t('common.done')),
    ]),
  ]), { wide: true });

  const origClose = m.close;
  m.close = () => {
    fields.forEach(f => { f.flush(); });
    origClose();
    onClose?.();
  };
}

export function buildStockMediaGroup(s: Settings, save: (patch?: Partial<Settings>) => void) {
  const statusEl = el('span', { class: 'integrations-status muted' }, stockMediaKeySummary(s));
  const refreshStatus = () => { statusEl.textContent = stockMediaKeySummary(s); };

  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.media.title')),
    el('div', { class: 'setting-row integrations-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.media.providers')),
        statusEl,
        el('span', { class: 'muted', style: 'display:block;font-size:12px;margin-top:4px' },
          t('settings.media.providersHint')),
      ]),
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => openKeysModal(s, save, refreshStatus),
      }, t('settings.media.configure')),
    ]),
  ]);
}
