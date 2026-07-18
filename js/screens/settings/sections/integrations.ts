import { el, modal } from '../../../ui/ui.js';
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
  help: { linkText: string; linkHref: string; steps: string[] };
}

const KEY_DEFS: KeyDef[] = [
  {
    prop: 'supadataApiKey',
    title: 'Supadata API ключ',
    placeholder: 'sd_…',
    required: true,
    lead: 'Обязателен: достаёт субтитры и транскрипт из YouTube.',
    help: {
      linkText: 'supadata.ai',
      linkHref: 'https://supadata.ai',
      steps: [
        'Зарегистрируйся и открой раздел API Keys.',
        'Скопируй ключ и вставь сюда.',
        'Бесплатный тариф покрывает личное использование; одно видео = один запрос.',
      ],
    },
  },
  {
    prop: 'geminiApiKey',
    title: 'Gemini API ключ',
    placeholder: 'AIza…',
    lead: 'Генерация карточек: слова и переводы из транскрипта.',
    help: {
      linkText: 'Google AI Studio',
      linkHref: 'https://aistudio.google.com/apikey',
      steps: [
        'Создай API key в Google AI Studio.',
        'Вставь ключ (AIza… или новый формат AQ.…).',
        'Если пусто — используется серверный ключ (если настроен).',
      ],
    },
  },
  {
    prop: 'groqApiKey',
    title: 'Groq API ключ',
    placeholder: 'gsk_…',
    lead: 'Резерв, если у Gemini кончилась квота.',
    help: {
      linkText: 'console.groq.com/keys',
      linkHref: 'https://console.groq.com/keys',
      steps: [
        'Создай API Key в Groq Console.',
        'Вставь ключ (начинается с gsk_…).',
        'Если модели отключены в проекте — Project → Limits: включи GPT OSS.',
        'Если пусто — используется серверный ключ (если настроен).',
      ],
    },
  },
];

function validateKey(prop: KeyProp, value: unknown) {
  const v = String(value || '').trim();
  if (!v) return { ok: true, message: '' };
  if (prop === 'geminiApiKey' && !cleanGeminiApiKey(v)) {
    return { ok: false, message: 'Неверный формат — ключ AI Studio: AIza… или AQ.…' };
  }
  if (prop === 'groqApiKey' && !cleanGroqApiKey(v)) {
    return { ok: false, message: 'Неверный формат — ключ Groq начинается с gsk_…' };
  }
  if (prop === 'supadataApiKey' && !cleanSupadataApiKey(v)) {
    return { ok: false, message: 'Неверный формат ключа Supadata' };
  }
  return { ok: true, message: '' };
}

function updateKeyStatus(statusEl: HTMLElement, def: KeyDef, value: unknown) {
  const next = String(value || '').trim();
  if (!next) {
    statusEl.textContent = def.required ? 'Не указан — импорт недоступен' : 'Не указан — серверный (если есть)';
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
  statusEl.textContent = 'Ключ сохранён';
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
      toggleBtn.textContent = visible ? 'Скрыть' : 'Показать';
    },
  }, 'Показать') as HTMLButtonElement;

  function flush() {
    const next = keyInput.value.trim();
    let normalized = next;
    if (def.prop === 'geminiApiKey') normalized = cleanGeminiApiKey(next) || next;
    else if (def.prop === 'groqApiKey') normalized = cleanGroqApiKey(next) || next;
    else if (def.prop === 'supadataApiKey') normalized = cleanSupadataApiKey(next) || next;
    const check = validateKey(def.prop, normalized);
    updateKeyStatus(statusEl, def, normalized);
    if (!check.ok && normalized) {
      // Сохраняем как есть — сервер тоже попробует нормализовать
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
        el('summary', null, 'Как получить'),
        el('ol', null, [
          el('li', null, [
            'Открой ',
            el('a', { href: def.help.linkHref, target: '_blank', rel: 'noopener noreferrer' }, def.help.linkText),
            '.',
          ]),
           ...def.help.steps.map((step: string) => el('li', null, step)),
        ]),
        el('p', { class: 'muted api-key-note' },
          'Ключ сохраняется при нажатии «Готово». Передаётся на сервер только при импорте.'),
      ]),
    ]),
    el('div', { class: 'api-key-field' }, [keyInput, toggleBtn, statusEl]),
  ]);

  return { node, flush };
}

function openKeysModal(s: Settings, save: (patch?: Partial<Settings>) => void, onClose: () => void) {
  const fields = KEY_DEFS.map(def => buildKeyField(def, s, save));
  const body = el('div', { class: 'integrations-keys-modal' }, fields.map(f => f.node));

  const m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, 'API-ключи YouTube'),
    el('p', { class: 'modal-text muted' },
      'Supadata обязателен для транскрипта. Gemini — основной для карточек, Groq — резерв.'),
    body,
    el('div', { class: 'modal-actions' }, [
      el('button', {
        class: 'btn primary',
        onclick: () => {
          const ok = fields.every(f => f.flush());
          if (ok) m.close();
        },
      }, 'Готово'),
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
    el('h4', null, 'Карточки из YouTube'),
    el('div', { class: 'setting-row integrations-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'API-ключи'),
        statusEl,
      ]),
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => openKeysModal(s, save, refreshStatus),
      }, 'Настроить'),
    ]),
  ]);
}
