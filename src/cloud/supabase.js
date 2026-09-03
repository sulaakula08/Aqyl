/**
 * Тонкий клиент Supabase: авторизация через Google и синхронизация профиля.
 *
 * Почему не официальный SDK. Всё приложение держится на том, что грузится
 * по слабому каналу сельской школы: ноль зависимостей, ноль сборки, ~60 КБ
 * на всё. supabase-js в минифицированном виде — больше сотни килобайт, то
 * есть он один весил бы вдвое больше продукта. Нам нужны три вызова из его
 * API, и все три — обычный REST, который здесь и написан.
 *
 * Ключевое архитектурное решение: облако НЕ является источником правды.
 * Источник правды — localStorage на устройстве, как и было. Supabase лишь
 * добавляет вход и перенос прогресса между устройствами. Если облака нет,
 * оно не настроено или сеть отвалилась — приложение работает ровно как
 * раньше и ничего не теряет. Это защищает главный тезис продукта: ученик
 * без интернета продолжает заниматься.
 */

const LS_SESSION = 'aqyl.session';
const LS_CONFIG = 'aqyl.config';

let config = null;      // { url, anonKey } | null
let configLoaded = false;
let session = null;     // { access_token, refresh_token, expires_at, user }

/**
 * Ответ Google перехватывается на самом старте — до первой отрисовки.
 *
 * Supabase возвращает токены во фрагменте адреса, а фрагмент у нас занят
 * роутером. Если оставить всё как есть, роутер первым увидит путь
 * «access_token=ya29…», не найдёт такого экрана и мигнёт страницей
 * «Страница не найдена» — ровно в момент возвращения после входа.
 *
 * Этот модуль импортируется из main.js, значит его тело выполняется раньше
 * тела main.js. Поэтому здесь же и вычищаем адрес: токен не доживает до
 * роутера, не попадает в историю браузера и не светится в адресной строке
 * на демонстрации с проектора.
 */
const CAPTURED = (() => {
  const h = location.hash || '';
  if (!h.includes('access_token=')) return null;
  history.replaceState(null, '', location.pathname + location.search + '#/dashboard');
  return h;
})();

/* ─── Конфигурация ────────────────────────────────────────────────────── */

/**
 * Конфигурация приходит с /api/config, но кэшируется в localStorage:
 * при втором запуске без сети вход всё ещё можно показать честно
 * (кнопка будет, попытка входа скажет, что сети нет).
 */
export async function loadConfig() {
  if (configLoaded) return config;

  try {
    const cached = JSON.parse(localStorage.getItem(LS_CONFIG) || 'null');
    if (cached && cached.url) config = cached;
  } catch { /* повреждённый кэш не должен ломать запуск */ }

  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      config = data.supabase || null;
      if (config) localStorage.setItem(LS_CONFIG, JSON.stringify(config));
      else localStorage.removeItem(LS_CONFIG);
      // Ответ получен и однозначен — больше спрашивать незачем.
      configLoaded = true;
    }
  } catch { /* офлайн или эндпоинта нет — остаёмся на кэше и попробуем ещё */ }

  return config;
}

export const isConfigured = () => Boolean(config && config.url && config.anonKey);

/* ─── Сессия ──────────────────────────────────────────────────────────── */

function saveSession(s) {
  session = s;
  if (s) localStorage.setItem(LS_SESSION, JSON.stringify(s));
  else localStorage.removeItem(LS_SESSION);
}

export function restoreSession() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
    // Просроченный токен хуже отсутствующего: он даёт вид, что вход есть,
    // а любой запрос падает с 401.
    if (s && s.expires_at && s.expires_at * 1000 > Date.now()) session = s;
    else if (s) localStorage.removeItem(LS_SESSION);
  } catch { /* нет сессии — обычное состояние */ }
  return session;
}

export const getSession = () => session;
export const getUser = () => session?.user || null;

/**
 * Разбор ответа OAuth.
 *
 * Supabase возвращает токены во фрагменте URL. Фрагмент у нас занят
 * роутером, поэтому его надо не просто прочитать, а обязательно вычистить:
 * иначе access_token останется в адресной строке, попадёт в историю
 * браузера и в любой скриншот демонстрации.
 */
export async function handleRedirect() {
  const hash = CAPTURED;
  if (!hash) return null;

  // Supabase кладёт токены прямо во фрагмент: #access_token=…&expires_in=…
  const raw = new URLSearchParams(hash.slice(1));
  const token = raw.get('access_token');
  if (!token) return null;

  const expiresIn = Number(raw.get('expires_in')) || 3600;
  const next = {
    access_token: token,
    refresh_token: raw.get('refresh_token') || '',
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: null,
  };

  try {
    next.user = await fetchUser(next.access_token);
  } catch { return null; }

  saveSession(next);
  return next;
}

async function fetchUser(token) {
  const r = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`auth/user ${r.status}`);
  return await r.json();
}

/** Вход через Google. Уводит со страницы — возврат обработает handleRedirect. */
export function signInWithGoogle() {
  if (!isConfigured()) return false;
  const back = location.origin + location.pathname;
  const u = `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`;
  location.href = u;
  return true;
}

export function signOut() {
  // Выход локальный и намеренно не ждёт сеть: нажав «выйти» в школьном
  // компьютерном классе, ученик должен выйти немедленно, даже если
  // интернет в этот момент лежит.
  const token = session?.access_token;
  saveSession(null);
  if (token && isConfigured()) {
    fetch(`${config.url}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
    }).catch(() => { /* серверная сессия истечёт сама */ });
  }
}

/* ─── Синхронизация профиля ───────────────────────────────────────────── */

const REST = (path) => `${config.url}/rest/v1/${path}`;

function authHeaders() {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${session.access_token}`,
    'content-type': 'application/json',
  };
}

/**
 * Забрать сохранённый прогресс.
 * @returns {Promise<object|null>} снимок профиля или null, если его нет
 */
export async function pullProfile() {
  if (!isConfigured() || !session) return null;
  const r = await fetch(REST(`profiles?id=eq.${session.user.id}&select=data,updated_at`), {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(`pull ${r.status}`);
  const rows = await r.json();
  return rows[0] || null;
}

/**
 * Сохранить прогресс в облако.
 *
 * upsert по первичному ключу: у одного пользователя одна строка. Мы
 * сознательно храним профиль одним JSON-полем, а не разложенным по
 * таблицам: схема на устройстве меняется каждый спринт, и миграция
 * localStorage вместе с Postgres удвоила бы работу без выигрыша, пока
 * аналитики по этим данным нет.
 */
export async function pushProfile(profile) {
  if (!isConfigured() || !session) return false;
  const r = await fetch(REST('profiles'), {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: session.user.id,
      email: session.user.email,
      data: profile,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!r.ok) throw new Error(`push ${r.status}`);
  return true;
}
