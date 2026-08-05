# Security — КАР-точки (self-hosted)

КАР-точки — **не SaaS**. Вы деплоите свой инстанс; секреты и данные принадлежат вам.

## Модель угроз

| Актив | Где лежит | Кто видит |
|-------|-----------|-----------|
| Карточки / папки / журнал | Supabase (ваш проект) + локальное зеркало IDB | Только `user_id` владельца (RLS) |
| Сессия | `localStorage` (`kar_session`) | Браузер пользователя |
| Личные API-ключи (Supadata / Gemini / Groq / stock) | `settings` (облако или local) | Владелец аккаунта; уходят на **ваш** `/api/*` только в момент импорта/TTS |
| Серверные ключи | Cloudflare Pages secrets / env | Только Functions на вашем деплое |

## Что уже есть

- RLS на таблицах Supabase и Storage policies
- Санитайзер rich-text (`sanitizeRich`)
- Security headers в [`public/_headers`](../public/_headers) (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP) — копируются в `dist/` при `build:bundle`
- Rate-limit на Cloudflare Functions (`functions/api/_middleware.js` + KV) для дорогих `/api/*`

## Что вы должны настроить

1. **Свой** проект Supabase + миграции (`npm run db:push`).
2. Секреты Pages: `GEMINI_API_KEY` / `GROQ_API_KEY` / `SUPADATA_API_KEY` (и stock keys по желанию).
3. Не публикуйте `js/config.js` с чужими ключами в открытый форк.
4. Для публичного демо: либо личные BYOK-ключи у каждого пользователя, либо жёсткие Cloudflare rate limits / WAF — иначе чужой трафик сожжёт квоту LLM.

## Чего приложение само не закрывает

- Нет глобального auth-gate на `/api/*` (Functions доступны любому, кто знает URL инстанса).
- Ключи в `settings` не шифруются at-rest сверх того, что даёт Supabase.
- XSS через пользовательский контент смягчается санитайзером, но CSP + аккуратность с `innerHTML` остаются обязательными.

## Ротация ключей

1. Отозвать ключ у провайдера (Google AI Studio / Groq / Supadata).
2. Обновить Pages secret или ключ в Настройки → интеграции.
3. При утечке сессии — «Выйти» на всех устройствах и сменить пароль Supabase Auth.

## Отчёты

См. корневой [`SECURITY.md`](../SECURITY.md).
