# Audience Subscriptions And Event Reminders Design

## Purpose

Santiago має стати платформою, де логін корисний уже для visitor, а club member, mentor і admin отримують додаткові рівні цінності. Перший практичний крок: збережені події автоматично отримують нагадування через Telegram-бота за 24 години і за 3 години до початку.

Цей дизайн закладає ширший фундамент: збережене, системні сповіщення, підписки на майстрів, майбутні знижки, нові послуги, проєкти і розсилки.

## Core Model

Є три різні поняття:

1. `favorites` — особиста бібліотека користувача.
   Користувач зберігає подію, майстра, послугу, проєкт або контент, щоб бачити це в кабінеті.

2. `subscriptions.preferences`.
   Коли обʼєкт збережено, релевантні системні сповіщення вмикаються автоматично і керуються через `preferences`. Користувач може вимкнути їх у кабінеті.

3. `subscriptions`.
   Це явний дозвіл на ширші повідомлення. Найважливіший приклад: підписка на майстра дозволяє майстру писати своїм підписникам через бот не тільки про конкретну подію чи автоматичні оновлення.

## Product Rules

### Visitor

Visitor після Telegram-логіну може:

- зберігати події, майстрів, послуги, проєкти і контент;
- отримувати автоматичні нагадування по збережених подіях;
- отримувати автоматичні анонси по збережених майстрах і послугах;
- вимикати будь-які сповіщення в кабінеті;
- підписуватися на майстра, якщо хоче отримувати ширші повідомлення від нього.

### Club Member

Club member має всі visitor-функції плюс:

- закриті клубні події;
- спеціальні пропозиції;
- знижки;
- ранній доступ;
- клубні формати і комʼюніті.

Цей paywall не блокує базові platform-функції. Він додає причину купити клубний статус.

### Mentor

Mentor може:

- створювати заявки на події, послуги, проєкти і профіль;
- бачити аудиторію своїх подій, послуг і профілю після появи відповідного кабінету;
- писати всім учасникам конкретної події про цю подію;
- писати ширші повідомлення тільки тим, хто явно підписався на майстра;
- не писати довільні розсилки людям, які лише зберегли майстра, але не підписались.

### Admin

Admin керує:

- ролями;
- заявками;
- контентом;
- подіями;
- користувачами;
- системними і ручними розсилками.

## Notification Permission Rules

Збереження і підписка мають різні дозволи.

### Event

Коли користувач зберігає подію:

- подія зʼявляється в кабінеті;
- автоматично вмикаються reminders за 24 години і за 3 години;
- користувач може вимкнути reminders;
- mentor/admin може написати цій аудиторії тільки щодо цієї конкретної події.

### Mentor

Коли користувач зберігає майстра:

- майстер зʼявляється в кабінеті;
- автоматично можуть приходити системні анонси про нові події, нові послуги і знижки цього майстра;
- користувач може вимкнути окремі типи анонсів;
- mentor не отримує право на довільну розсилку.

Коли користувач підписується на майстра:

- mentor може робити ширші повідомлення своїм підписникам через бот;
- користувач може відписатися від цієї підписки в кабінеті.

### Service

Коли користувач зберігає послугу:

- послуга зʼявляється в кабінеті;
- автоматично можуть приходити системні анонси про знижки, нові дати, нові формати і відкриті місця;
- користувач може вимкнути ці сповіщення.

## First Release Scope

Перший реліз не реалізує всю систему. Він робить фундамент і один повний живий сценарій.

Included:

- зберігання подій уже існує через `favorites`;
- додаємо універсальні `subscriptions` і `subscription_notifications`;
- при збереженні події створюється активний subscription для event reminders;
- створюються дві notification-задачі: `event_reminder_24h` і `event_reminder_3h`;
- бот регулярно перевіряє due notifications і надсилає Telegram-повідомлення;
- після успішної відправки бот ставить `sent_at`;
- у кабінеті показуємо збережені події і стан нагадувань;
- користувач може вимкнути reminders для збереженої події.

Deferred:

- повна mentor-аудиторія;
- ручні mentor-broadcasts;
- знижки на послуги;
- project updates;
- admin panel для розсилок;
- granular UI для кожного типу системних анонсів.

## Data Design

### `favorites`

Поточну таблицю лишаємо як бібліотеку збереженого. Її варто розширити, щоб підтримати:

- `event`;
- `service`;
- `mentor`;
- `project`;
- `content`.

`favorites` не повинна сама бути scheduler-таблицею.

### `subscriptions`

Нова таблиця для активних permission/notification-сценаріїв.

Fields:

- `id uuid primary key`;
- `user_id uuid references profiles(id)`;
- `target_type text` with values like `event`, `mentor`, `service`, `project`, `content`;
- `target_key text`;
- `status text` with `active`, `paused`, `cancelled`;
- `source text` with values like `favorite_auto`, `explicit_subscribe`, `booking`;
- `preferences jsonb`;
- `metadata jsonb`;
- `created_at timestamptz`;
- `updated_at timestamptz`;
- unique key on `user_id`, `target_type`, `target_key`, `source`.

For event reminders, `preferences` stores:

```json
{
  "event_reminders": true,
  "offset_minutes": [1440, 180]
}
```

For mentor subscriptions later:

```json
{
  "mentor_broadcasts": true,
  "new_events": true,
  "new_services": true,
  "discounts": true
}
```

### `subscription_notifications`

Scheduler table for concrete bot messages.

Fields:

- `id uuid primary key`;
- `subscription_id uuid references subscriptions(id)`;
- `user_id uuid references profiles(id)`;
- `target_type text`;
- `target_key text`;
- `kind text`;
- `send_at timestamptz`;
- `payload jsonb`;
- `status text` with `pending`, `sent`, `cancelled`, `failed`;
- `sent_at timestamptz`;
- `failed_at timestamptz`;
- `error text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

For first release, `kind` supports:

- `event_reminder_24h`;
- `event_reminder_3h`.

## Website UX

### Public Pages

Public page buttons should stay simple:

- primary action: `Зберегти`;
- after save, show an expanded state or compact menu:
  - `Видалити`;
  - for event: `Нагадування увімкнено`;
  - for mentor later: `Підписатися`;
  - for service later: `Сповіщення увімкнено`.

Saving should feel useful immediately, so event reminders turn on automatically.

### Cabinet

Cabinet is the management space, so cards should expose separate actions:

- `Відкрити`;
- `Нагадування`;
- `Підписка`;
- `Видалити`.

Cabinet sections:

- `Моє збережене`;
- filters: `Події`, `Майстри`, `Послуги`, `Проєкти`, `Контент`;
- sorting: newest, nearest events, active notifications;
- future section: `Активні нагадування`.

The cabinet also needs an explanation banner:

- text/button: `Як працює мій кабінет?`;
- clicking opens a popup explaining:
  - saved items;
  - automatic reminders;
  - subscriptions;
  - visitor vs club member;
  - mentor tools;
  - admin moderation.

## Bot Flow

The bot should use service-role Supabase access and run a periodic notification check.

For first release:

1. Query `subscription_notifications` where:
   - `status = 'pending'`;
   - `send_at <= now()`;
   - related subscription is still `active`.
2. Load user profile by `user_id`.
3. Send Telegram message to `profiles.telegram_id`.
4. Mark notification `sent` with `sent_at`.
5. On failure, mark `failed` with error details or retry later.

Message examples:

- 24h: `Завтра подія: {title}. Початок: {time}.`
- 3h: `Сьогодні подія: {title}. Початок: {time}.`

## Error Handling

- If the event date is in the past, no reminder notifications are created.
- If only the 3h reminder is still in the future, create only the 3h notification.
- If a user logs out locally, saved data remains in Supabase.
- If a subscription is cancelled, pending notifications are cancelled.
- If Telegram send fails, the notification is marked failed with the bot error.
- Duplicate saves should upsert the favorite and subscription without creating duplicate pending notifications.

## Testing

First release verification:

- saving an event creates/updates favorite and event reminder subscription;
- saving an event schedules 24h and 3h notifications when those times are future;
- saving the same event twice does not duplicate notifications;
- cancelling reminders cancels pending notifications;
- bot sends due reminders and marks them sent;
- bot ignores cancelled subscriptions;
- cabinet shows saved event cards and reminder state;
- unauthenticated visitor gets Telegram login prompt.

## Implementation Order

1. Add SQL migration for `subscriptions` and `subscription_notifications`.
2. Add RPCs for event reminder subscription upsert, cancellation, and listing.
3. Add frontend helper module or extend existing favorites layer carefully.
4. Add event reminder action to the calendar event popup.
5. Add cabinet rendering for reminder state and cancel action.
6. Add bot scheduler loop for pending subscription notifications.
7. Smoke-test with local static site and bot logs.

## Open Product Decisions Resolved For MVP

- Saving an event automatically enables reminders.
- Event reminders default to 24 hours and 3 hours before start.
- The user can disable reminders later in the cabinet.
- Saving a mentor later enables system updates, but not free-form mentor broadcasts.
- Explicit mentor subscription later enables broader mentor broadcasts.
- Event participant messaging is scoped to that event.
