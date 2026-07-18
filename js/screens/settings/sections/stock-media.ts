import { el, modal } from '../../../ui/ui.js';
import { stockMediaKeySummary } from '../../../lib/stock-media-settings.js';
import { cleanGiphyApiKey, cleanPixabayApiKey } from '../../../lib/llm-api-keys.js';
import type { Settings } from '../../../data/types.js';

type KeyProp = 'pixabayApiKey' | 'giphyApiKey';

interface KeyDef {
  prop: KeyProp;
  title: string;
  placeholder: string;
  lead: string;
  help: { linkText: string; linkHref: string; steps: string[] };
}

const KEY_DEFS: KeyDef[] = [
  {
    prop: 'pixabayApiKey',
    title: 'Pixabay API ключ',
    placeholder: '12345678-abcdef…',
    lead: '5+ млн фото и иллюстраций (бесплатная лицензия Pixabay).',
    help: {
      linkText: 'pixabay.com/api/docs',
      linkHref: 'https://pixabay.com/api/docs/',
      steps: [
        'Зарегистрируйся на Pixabay и открой API documentation.',
        'Скопируй API key и вставь сюда.',
        'Бесплатно: до 100 запросов в минуту — хватит для личных карточек.',
      ],
    },
  },
  {
    prop: 'giphyApiKey',
    title: 'Giphy API ключ',
    placeholder: '…',
    lead: 'Огромная база GIF и стикеров.',
    help: {
      linkText: 'developers.giphy.com',
      linkHref: 'https://developers.giphy.com/dashboard/',
      steps: [
        'Создай приложение в Giphy Developers Dashboard.',
        'Скопируй API Key.',
        'Бесплатный тариф подходит для личного использования.',
      ],
    },
  },
];

function validateKey(prop: KeyProp, value: unknown) {
  const v = String(value || '').trim();
  if (!v) return { ok: true, message: '' };
  if (prop === 'pixabayApiKey' && !cleanPixabayApiKey(v)) {
    return { ok: false, message: 'Формат: 12345678-abcdef…' };
  }
  if (prop === 'giphyApiKey' && !cleanGiphyApiKey(v)) {
    return { ok: false, message: 'Неверный формат ключа Giphy' };
  }
  return { ok: true, message: '' };
}

function updateKeyStatus(statusEl: HTMLElement, def: KeyDef, value: unknown) {
  const next = String(value || '').trim();
  if (!next) {
    statusEl.textContent = 'Не указан — базовый поиск Openverse';
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
          'Ключ сохраняется локально и передаётся на сервер только при поиске картинок.'),
      ]),
    ]),
    el('div', { class: 'api-key-field' }, [keyInput, toggleBtn, statusEl]),
  ]);

  return { node, flush };
}

function openKeysModal(s: Settings, save: (patch?: Partial<Settings>) => void, onClose: () => void) {
  const fields = KEY_DEFS.map(def => buildKeyField(def, s, save));
  const m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, 'API-ключи для картинок'),
    el('p', { class: 'modal-text muted' },
      'Pixabay — фото и иллюстрации. Giphy — GIF и стикеры. Без ключей работает ограниченный Openverse.'),
    el('div', { class: 'integrations-keys-modal' }, fields.map(f => f.node)),
    el('div', { class: 'modal-actions' }, [
      el('button', {
        class: 'btn primary',
        onclick: () => { if (fields.every(f => f.flush())) m.close(); },
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

export function buildStockMediaGroup(s: Settings, save: (patch?: Partial<Settings>) => void) {
  const statusEl = el('span', { class: 'integrations-status muted' }, stockMediaKeySummary(s));
  const refreshStatus = () => { statusEl.textContent = stockMediaKeySummary(s); };

  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Картинки для карточек'),
    el('div', { class: 'setting-row integrations-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Pixabay + Giphy'),
        statusEl,
        el('span', { class: 'muted', style: 'display:block;font-size:12px;margin-top:4px' },
          'Бесплатные ключи открывают миллионы фото, иллюстраций, GIF и стикеров.'),
      ]),
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => openKeysModal(s, save, refreshStatus),
      }, 'Настроить'),
    ]),
  ]);
}
