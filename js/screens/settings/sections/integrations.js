import { el } from '../../../ui/ui.js';

// Поля личных API-ключей для «Карточки из YouTube». Ключ из настроек имеет
// приоритет над серверным (Netlify env); пустое поле = используется серверный.

const KEYS = [
  {
    prop: 'geminiApiKey',
    title: 'Gemini API ключ',
    placeholder: 'AIza…',
    lead: 'Основной: нейросеть выделяет слова и фразы из субтитров и составляет переводы.',
    help: {
      linkText: 'Google AI Studio',
      linkHref: 'https://aistudio.google.com/apikey',
      steps: [
        'Войдите в Google-аккаунт и нажмите «Create API key».',
        'Скопируйте ключ (начинается с AIza…) и вставьте его ниже.',
        'У Google есть бесплатный лимит на Gemini Flash; одно видео = один запрос.',
      ],
    },
  },
  {
    prop: 'groqApiKey',
    title: 'Groq API ключ',
    placeholder: 'gsk_…',
    lead: 'Резервный: подхватывает генерацию, если у Gemini кончилась квота, и распознаёт речь в роликах без субтитров.',
    help: {
      linkText: 'console.groq.com/keys',
      linkHref: 'https://console.groq.com/keys',
      steps: [
        'Зарегистрируйтесь (бесплатно) и нажмите «Create API Key».',
        'Скопируйте ключ (начинается с gsk_…) и вставьте его ниже.',
        'Бесплатного лимита Groq хватает с запасом: Llama для карточек, Whisper для расшифровки речи.',
      ],
    },
  },
];

function buildKeyField(def, s, save) {
  let visible = false;
  const isSet = () => !!String(s[def.prop] || '').trim();

  const keyInput = el('input', {
    type: 'password',
    class: 'input api-key-input',
    placeholder: def.placeholder,
    autocomplete: 'off',
    spellcheck: false,
    value: s[def.prop] || '',
  });

  const statusEl = el('span', {
    class: 'api-key-status' + (isSet() ? ' is-set' : ''),
  }, isSet() ? 'Ключ сохранён' : 'Ключ не указан — используется серверный (если настроен)');

  const toggleBtn = el('button', {
    type: 'button',
    class: 'btn ghost api-key-toggle',
    onclick: () => {
      visible = !visible;
      keyInput.type = visible ? 'text' : 'password';
      toggleBtn.textContent = visible ? 'Скрыть' : 'Показать';
    },
  }, 'Показать');

  function persist() {
    const next = keyInput.value.trim();
    if (next === (s[def.prop] || '')) return;
    s[def.prop] = next;
    statusEl.textContent = next ? 'Ключ сохранён' : 'Ключ не указан — используется серверный (если настроен)';
    statusEl.classList.toggle('is-set', !!next);
    save();
  }

  keyInput.addEventListener('blur', persist);
  keyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      keyInput.blur();
    }
  });

  return el('div', { class: 'setting-row setting-row-stack api-key-block' }, [
    el('div', { class: 'lab' }, [
      el('b', null, def.title),
      el('span', { class: 'api-key-lead' }, def.lead),
      el('details', { class: 'api-key-help' }, [
        el('summary', null, 'Как получить ключ'),
        el('ol', null, [
          el('li', null, [
            'Откройте ',
            el('a', {
              href: def.help.linkHref,
              target: '_blank',
              rel: 'noopener noreferrer',
            }, def.help.linkText),
            '.',
          ]),
          ...def.help.steps.map(step => el('li', null, step)),
        ]),
        el('p', { class: 'muted api-key-note' },
          'Ключ хранится в ваших настройках и передаётся на сервер приложения только при импорте из YouTube.'),
      ]),
    ]),
    el('div', { class: 'api-key-field' }, [keyInput, toggleBtn, statusEl]),
  ]);
}

export function buildIntegrationsGroup(s, save) {
  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Карточки из YouTube'),
    el('p', { class: 'integrations-lead muted' },
      'Личные API-ключи для импорта карточек из роликов. Если поле пустое, используется общий ключ сервера (настраивается в Netlify) — свои ключи дают собственные бесплатные лимиты.'),
    ...KEYS.map(def => buildKeyField(def, s, save)),
  ]);
}
