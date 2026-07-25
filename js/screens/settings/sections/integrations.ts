import { el, modal } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';
import { integrationsKeySummary } from '../../../lib/youtube-import-settings.js';
import { cleanGeminiApiKey, cleanGroqApiKey, cleanSupadataApiKey } from '../../../lib/llm-api-keys.js';
import type { Settings } from '../../../data/types.js';

type KeyProp = 'supadataApiKey' | 'geminiApiKey' | 'groqApiKey';

interface KeyDef {
  prop: KeyProp;
  title: string;
  placeholder: string;
  required?: boolean;
  lead: string;
  helpOpen: string;
  helpHow: string;
  keyNote: string;
  help: { linkText: string; linkHref: string; steps: string[] };
}

function getKeyDefs(): KeyDef[] {
  return [
    {
      prop: 'supadataApiKey',
      title: t('settings.yt.supadata.title'),
      placeholder: 'sd_…',
      required: true,
      lead: t('settings.yt.supadata.lead'),
      helpOpen: t('settings.yt.helpOpen'),
      helpHow: t('settings.yt.helpHow'),
      keyNote: t('settings.yt.keyNote'),
      help: {
        linkText: 'supadata.ai',
        linkHref: 'https://supadata.ai',
        steps: [
          t('settings.yt.supadata.step1'),
          t('settings.yt.supadata.step2'),
          t('settings.yt.supadata.step3'),
        ],
      },
    },
    {
      prop: 'geminiApiKey',
      title: t('settings.yt.gemini.title'),
      placeholder: 'AIza…',
      lead: t('settings.yt.gemini.lead'),
      helpOpen: t('settings.yt.helpOpen'),
      helpHow: t('settings.yt.helpHow'),
      keyNote: t('settings.yt.keyNote'),
      help: {
        linkText: 'Google AI Studio',
        linkHref: 'https://aistudio.google.com/apikey',
        steps: [
          t('settings.yt.gemini.step1'),
          t('settings.yt.gemini.step2'),
          t('settings.yt.gemini.step3'),
        ],
      },
    },
    {
      prop: 'groqApiKey',
      title: t('settings.yt.groq.title'),
      placeholder: 'gsk_…',
      lead: t('settings.yt.groq.lead'),
      helpOpen: t('settings.yt.helpOpen'),
      helpHow: t('settings.yt.helpHow'),
      keyNote: t('settings.yt.keyNote'),
      help: {
        linkText: 'console.groq.com/keys',
        linkHref: 'https://console.groq.com/keys',
        steps: [
          t('settings.yt.groq.step1'),
          t('settings.yt.groq.step2'),
          t('settings.yt.groq.step3'),
          t('settings.yt.groq.step4'),
        ],
      },
    },
  ];
}

function validateKey(prop: KeyProp, value: unknown) {
  const v = String(value || '').trim();
  if (!v) return { ok: true, message: '' };
  if (prop === 'geminiApiKey' && !cleanGeminiApiKey(v)) {
    return { ok: false, message: t('settings.yt.invalidGemini') };
  }
  if (prop === 'groqApiKey' && !cleanGroqApiKey(v)) {
    return { ok: false, message: t('settings.yt.invalidGroq') };
  }
  if (prop === 'supadataApiKey' && !cleanSupadataApiKey(v)) {
    return { ok: false, message: t('settings.yt.invalidSupadata') };
  }
  return { ok: true, message: '' };
}

function updateKeyStatus(statusEl: HTMLElement, def: KeyDef, value: unknown) {
  const next = String(value || '').trim();
  if (!next) {
    statusEl.textContent = def.required
      ? t('settings.yt.statusMissingRequired')
      : t('settings.yt.statusMissingOptional');
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
  statusEl.textContent = t('settings.yt.statusSaved');
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
    if (def.prop === 'geminiApiKey') normalized = cleanGeminiApiKey(next) || next;
    else if (def.prop === 'groqApiKey') normalized = cleanGroqApiKey(next) || next;
    else if (def.prop === 'supadataApiKey') normalized = cleanSupadataApiKey(next) || next;
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
    if (e.key === 'Enter') {
      e.preventDefault();
      keyInput.blur();
    }
  });

  const node = el('div', { class: 'api-key-block' }, [
    el('div', { class: 'lab' }, [
      el('b', null, def.title + (def.required ? ' *' : '')),
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
  const body = el('div', { class: 'integrations-keys-modal' }, fields.map(f => f.node));

  const m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, t('settings.yt.modalTitle')),
    el('p', { class: 'modal-text muted' }, t('settings.yt.modalIntro')),
    body,
    el('div', { class: 'modal-actions' }, [
      el('button', {
        class: 'btn primary',
        onclick: () => {
          const ok = fields.every(f => f.flush());
          if (ok) m.close();
        },
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

export function buildIntegrationsGroup(s: Settings, save: (patch?: Partial<Settings>) => void) {
  const statusEl = el('span', { class: 'integrations-status muted' }, integrationsKeySummary(s));

  const refreshStatus = () => {
    statusEl.textContent = integrationsKeySummary(s);
  };

  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.yt.title')),
    el('div', { class: 'setting-row integrations-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.yt.apiKeys')),
        statusEl,
      ]),
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => openKeysModal(s, save, refreshStatus),
      }, t('settings.yt.configure')),
    ]),
    el('div', { class: 'setting-row integrations-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.yt.extension')),
        el('span', { class: 'integrations-status muted' }, t('settings.yt.extensionHint')),
      ]),
      el('a', {
        class: 'btn',
        href: 'https://github.com/PaperPit/kar-dots/blob/main/docs/chrome-extension.md',
        target: '_blank',
        rel: 'noopener noreferrer',
      }, t('settings.yt.installGuide')),
    ]),
  ]);
}
