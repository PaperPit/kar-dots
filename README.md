# КАР-точки 🐦‍⬛

[![CI](https://github.com/PaperPit/kar-dots/actions/workflows/ci.yml/badge.svg)](https://github.com/PaperPit/kar-dots/actions/workflows/ci.yml)
[![Deploy Cloudflare Pages](https://github.com/PaperPit/kar-dots/actions/workflows/deploy-cloudflare-pages.yml/badge.svg)](https://github.com/PaperPit/kar-dots/actions/workflows/deploy-cloudflare-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

**Open-source PWA для личного использования** — разверните для себя и поделитесь ссылкой с друзьями.  
TypeScript → vanilla JS (ES modules). Ваш инстанс, ваши данные, ваш Supabase (если нужен sync).

> **КАР**-точки = ворона + карточки. Не сервис с подпиской, а **репозиторий, который вы хостите сами** — как личная Anki в браузере.

**Демо:** [https://kar-tochki.pages.dev](https://kar-tochki.pages.dev)  
**[📖 Полная инструкция](docs/USER-GUIDE.md)** · [Roadmap](ROADMAP.md) · [Участие](CONTRIBUTING.md) · [English](#english)

---

## Для кого этот проект

КАР-точки — **self-hosted open source** для тех, кто хочет:

- учить слова и термины **без чужого SaaS** и без установки десктоп-приложения;
- **развернуть на Cloudflare Pages** (рекомендуется) или другом HTTPS-хостинге;
- **дать ссылку друзьям** — каждый регистрируется на *вашем* инстансе и получает **отдельную** коллекцию;
- при желании **форкнуть** и допилить под свой сценарий (MIT).

Это **не коммерческий SaaS**. Рекомендуем свой деплой на [Cloudflare Pages](docs/cloudflare-pages-setup.md) и свой проект Supabase — тогда данные и инстанс полностью ваши.

**Ищем идеи по развитию** — если форкаете или разворачиваете, расскажите, чего не хватает: [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) или [ROADMAP.md](ROADMAP.md).

---

## Разверните для себя

> **Пошагово** (Cloudflare, компьютер, телефон, Supabase, друзья):  
> **[docs/USER-GUIDE.md](docs/USER-GUIDE.md)**

| Сценарий | Что нужно | Sync между устройствами |
|----------|-----------|-------------------------|
| **Только я, локально** | `npm install && npm run dev` | Нет (данные в браузере) |
| **Я + телефон, без сервера БД** | Деплой на Cloudflare Pages + PWA, режим «без регистрации» + экспорт JSON | Вручную через бэкап |
| **Я + друзья, с аккаунтами** | Cloudflare Pages + **ваш** [Supabase](docs/DEPLOY.md#supabase-ваш-инстанс-для-себя-и-друзей) | Да, у каждого свой аккаунт |

### Минимальный деплой

1. **Fork** репозитория или `git clone`
2. Задеплоить на **Cloudflare Pages** — **[пошагово →](docs/cloudflare-pages-setup.md)** (или GitHub Action уже в репо)
3. Раздать ссылку вида `https://ваше-имя.pages.dev`
4. *(Опционально)* Подключить Supabase → каждый создаёт аккаунт на **вашем** инстансе

```bash
git clone https://github.com/PaperPit/kar-dots.git
cd kar-dots
npm install
npm run dev          # http://localhost:8080 (dev + API)
npm run pages:dev    # эмуляция прод-сборки Cloudflare
```

**Важно:** API-ключи YouTube/Gemini/Groq — **ваши**, в настройках приложения или env на хостинге. Maintainer не предоставляет общий бэкенд для чужих инстансов.

---

## Скриншоты

| Главная — коробки, drag-and-drop, тёмная тема | Папка и карточки | Режимы повторения | Настройки SRS |
|:---:|:---:|:---:|:---:|
| ![Главная](docs/screenshots/home.png) | ![Папка](docs/screenshots/folder.png) | ![Режимы](docs/screenshots/review-modes.png) | ![Настройки](docs/screenshots/settings.png) |

---

## Теги и поиск

**Topics на репозитории (20/20):**  
`flashcards` · `spaced-repetition` · `fsrs` · `sm-2` · `leitner-system` · `pwa` · `vanilla-js` · `self-hosted` · `language-learning` · `vocabulary` · `education` · `memorization` · `active-recall` · `cloze-deletion` · `youtube` · `offline-first` · `indexeddb` · `supabase` · `open-source` · `anki-alternative`

| Запрос | Почему подходит |
|--------|-----------------|
| карточки для запоминания, флешкарты | PWA для слов и терминов |
| интервальное повторение, SRS | SM-2, FSRS, Лейтнер |
| альтернатива Anki / Quizlet | веб, без установки, open source |
| изучение английского, vocabulary app | паки, перевод, TTS, YouTube-импорт |
| cloze / пропуски в словах | режим «Пропуски» |
| карточки из YouTube | импорт по субтитрам + LLM |
| PWA офлайн | service worker, локальный режим |
| self-hosted flashcards | форк + Cloudflare Pages |
| личные карточки для друзей, не SaaS | свой инстанс + опционально Supabase |

---

## Возможности

### Карточки и контент
- Лицо / оборот с **определением** и **описанием**, rich-text (жирный, ссылка, подсветка)
- Картинки на любой стороне, drag-and-drop; **поиск стоковых фото и GIF** (Openverse, Pixabay, Giphy)
- **Просмотр карточки** перед сохранением (flip-превью в редакторе)
- Папки с цветами и иконками, **коробки** для групп папок; **перетаскивание папок** в коробку и обратно
- Массовый импорт (`слово — перевод`), автоперевод RU↔EN, экспорт/импорт JSON
- **Карточки из YouTube** — субтитры + LLM (Gemini / Groq), см. [docs/youtube-import-setup.md](docs/youtube-import-setup.md)
- Готовые **паки слов** в `packs/`

### Повторение (SRS)
- Алгоритмы: **SM-2**, **FSRS** (желаемое удержание + *fuzz*), **коробки Лейтнера**
- Режимы: классика, **ввод ответа**, **пропуски (cloze)**, голос, **пары**, микс
- Лимит **новых** и **повторений** в день, направление лицо↔оборот, календарь активности
- **Журнал повторений** и экран **статистики**: удержание, повторения за 30 дней, прогноз нагрузки, разбивка по папкам
- Озвучка: **Web Speech API** и опционально **Orpheus TTS** (Groq)

### Платформа
- **Self-hosted** на Cloudflare Pages (статика `dist/` + Functions `/api/*`)
- **PWA**: офлайн-кэш, установка на iOS/Android
- **Локальный режим** (IndexedDB) и **облако** (ваш Supabase)
- Светлая / тёмная тема; клавиатура и свайпы на review

---

## Быстрый старт

| Цель | Действие |
|------|----------|
| **Развернуть и пользоваться** | **[docs/USER-GUIDE.md](docs/USER-GUIDE.md)** |
| Посмотреть UI локально | `npm install` → `npm run dev` → http://localhost:8080 |
| Деплой Cloudflare | [docs/cloudflare-pages-setup.md](docs/cloudflare-pages-setup.md) |
| Админ: Functions, миграции | [docs/DEPLOY.md](docs/DEPLOY.md) |
| Править код | [CLAUDE.md](CLAUDE.md) |

```bash
git clone https://github.com/PaperPit/kar-dots.git
cd kar-dots
npm install
npm run dev     # http://localhost:8080
npm test        # Vitest
```

---

## Деплой и облако

| Задача | Документ |
|--------|----------|
| **Пошагово: деплой, ПК, телефон, друзья** | **[USER-GUIDE.md](./USER-GUIDE.md)** |
| Cloudflare Pages (основной хостинг) | [cloudflare-pages-setup.md](./cloudflare-pages-setup.md) |
| Functions, миграции SQL, troubleshooting | [DEPLOY.md](./DEPLOY.md) |
| YouTube-импорт (API-ключи) | [youtube-import-setup.md](./youtube-import-setup.md) |
| iOS / Xcode (нативная оболочка) | [IOS.md](./IOS.md) |

---

## Стек

| Слой | Технологии |
|------|------------|
| UI | HTML, CSS, TypeScript → vanilla JS (ES modules) |
| Dev | `tsc` на место, **без bundler** (`npm run dev`) |
| Prod | `npm run build:bundle` (esbuild → `dist/`) |
| Анимации | [Motion](https://motion.dev/) (vendor bundle) |
| Локальные данные | IndexedDB |
| Облако | [Supabase](https://supabase.com) (Auth, Postgres, Storage) |
| SRS | SM-2, FSRS (`ts-fsrs`), Leitner |
| Serverless | **Cloudflare Pages Functions** (`functions/api/`) + Workers KV |
| Деплой | Cloudflare Pages + GitHub Action на `main` |
| Тесты | Vitest + happy-dom |

---

## Структура

```
index.html              — точка входа PWA (dev)
js/**/*.ts              — исходники (компилируются в js/**/*.js)
js/screens/             — экраны (home, review, settings, stats, …)
functions/api/          — Cloudflare Pages Functions (YouTube, LLM, TTS, stock)
wrangler.toml           — Pages + KV YT_JOBS
dist/                   — прод-сборка (esbuild)
supabase/migrations/    — схема БД
.github/workflows/      — CI + deploy на Cloudflare Pages
netlify/functions/      — legacy (запасной путь, не основной)
tests/                  — unit-тесты
```

---

## Участие в проекте

- **Идеи и голосование** → [ROADMAP.md](ROADMAP.md) + Issues
- **Баг или фича** → шаблоны в [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/)
- **Код** → [CONTRIBUTING.md](CONTRIBUTING.md)

---

## English

**KAR-dots** is a **self-hosted, open-source** flashcard PWA. Live demo: [kar-tochki.pages.dev](https://kar-tochki.pages.dev). Deploy on **Cloudflare Pages** (recommended) — share the link; each person gets a private collection (optional Supabase). Not a commercial SaaS.

Features: SM-2, FSRS, Leitner; typing, cloze, voice, matching; YouTube import; stock images; daily review budget; stats screen; light/dark theme; offline PWA. TypeScript → vanilla JS, MIT license.

See [docs/cloudflare-pages-setup.md](docs/cloudflare-pages-setup.md) and [docs/DEPLOY.md](docs/DEPLOY.md). Ideas: [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md).

---

## Лицензия

[MIT](LICENSE) — разворачивайте для себя, форкайте, делитесь с друзьями, предлагайте улучшения в upstream.

---

<p align="center">
  ⭐ Star на GitHub помогает другим найти self-hosted альтернативу для карточек.<br>
  Развернули свой инстанс? Расскажите в Issues — интересно, как вы используете.
</p>
