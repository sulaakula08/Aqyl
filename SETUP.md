# Supabase + вход через Google

Код уже написан и задеплоен. Не хватает только проекта Supabase — его нельзя
создать за тебя: нужен вход в supabase.com и в Google Cloud Console под твоим
аккаунтом.

Пока ключей нет, `/api/config` отдаёт `auth: false`, и кнопка входа просто не
показывается. Сайт при этом полностью работает — вход нужен только для
переноса прогресса между устройствами.

Твоя часть — примерно 8 минут. После неё пришли мне **URL** и **anon key**,
остальное (переменные Vercel, редеплой, проверка живого входа) я доделаю сам.

---

## 1. Проект Supabase — 2 минуты

1. https://supabase.com → **Start your project** → войти через GitHub
2. **New project**
   - Name: `aqyl`
   - Database password: сгенерировать и **сохранить** (пригодится позже, в коде не нужен)
   - Region: **Frankfurt (eu-central-1)** — ближайший к Казахстану из доступных
3. Дождаться, пока проект поднимется (~1 мин)

## 2. Таблица и политики доступа — 1 минута

**Project → SQL Editor → New query.** Вставить целиком содержимое
[`supabase/schema.sql`](supabase/schema.sql) и нажать **Run**.

Должно ответить `Success. No rows returned`.

> Не пропускай этот шаг и не «упрощай» его, отключив RLS. Anon-ключ лежит
> в браузере у каждого посетителя, и политики из этого файла — единственное,
> что мешает любому ученику прочитать прогресс всех остальных.

## 3. Google OAuth — 4 минуты

### 3.1. Сначала возьми Callback URL из Supabase

**Authentication → Sign In / Providers → Google.** Там показан
**Callback URL (for OAuth)** вида:

```
https://<твой-проект>.supabase.co/auth/v1/callback
```

Скопируй его — он нужен на следующем шаге. Вкладку не закрывай.

### 3.2. Google Cloud Console

1. https://console.cloud.google.com → создать проект `aqyl`
2. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create
   - App name: `AQYL`, support email — твой, developer contact — твой
   - Save and continue до конца, затем **Publish app**
     (в режиме Testing войти смогут только вручную добавленные аккаунты —
     на защите это гарантированный провал демонстрации)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `AQYL web`
   - **Authorized JavaScript origins:**
     ```
     https://aqylo.vercel.app
     http://localhost:4173
     ```
   - **Authorized redirect URIs:** вставить Callback URL из шага 3.1
     ```
     https://<твой-проект>.supabase.co/auth/v1/callback
     ```
   - Create → скопировать **Client ID** и **Client secret**

### 3.3. Обратно в Supabase

**Authentication → Sign In / Providers → Google:**
- Включить тумблер **Enable Sign in with Google**
- Вставить **Client ID** и **Client Secret**
- **Save**

### 3.4. Куда возвращать после входа

**Authentication → URL Configuration:**
- **Site URL:** `https://aqylo.vercel.app`
- **Redirect URLs** — добавить обе строки:
  ```
  https://aqylo.vercel.app
  http://localhost:4173
  ```

> Без этого Supabase отбросит `redirect_to` и вернёт пользователя не туда.

## 4. Пришли мне два значения

**Project Settings → API:**

- **Project URL** — `https://xxxxx.supabase.co`
- **anon / public** ключ — длинная строка на `eyJ…`

Оба публичны по устройству Supabase: anon-ключ и так попадает в браузер
каждого посетителя, его безопасность обеспечивают политики RLS из шага 2.

**Ключ `service_role` не присылай никогда.** Он игнорирует RLS и даёт полный
доступ к базе. В этом проекте он не нужен нигде.

---

## Что сделаю я, когда пришлёшь

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel --prod
```

Затем проверю на живом сайте: `/api/config` отдаёт `auth: true`, кнопка входа
появилась, реальный вход через Google проходит, профиль сохраняется в таблицу
и подтягивается на другом устройстве.

---

## Как это устроено в коде

| Файл | Роль |
|---|---|
| [`api/config.mjs`](api/config.mjs) | Отдаёт URL и anon-ключ из переменных окружения. Без сборщика подставить их в бандл негде, а править js руками — верный способ однажды закоммитить чужой ключ. |
| [`src/cloud/supabase.js`](src/cloud/supabase.js) | Клиент на голом REST, ~200 строк. Официальный SDK весит больше сотни килобайт — вдвое больше всего нашего приложения. |
| [`src/ui/auth.js`](src/ui/auth.js) | Блок входа внизу боковой панели и слияние прогресса. |

**Облако не является источником правды.** Источник правды — `localStorage`.
Supabase добавляет вход и перенос между устройствами; если его нет, он не
настроен или пропала сеть — приложение работает ровно как раньше. Это защищает
главный тезис продукта: ученик без интернета продолжает заниматься.

**Слияние прогресса** сравнивает длину журнала попыток, а не время записи.
Ученик решал задания в автобусе без сети, а до этого — в школьном классе;
затереть тридцать решённых заданий пятью только потому, что пять сохранились
позже, — худшее, что может сделать синхронизация.
