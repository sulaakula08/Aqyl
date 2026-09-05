/**
 * Микро-слой рендеринга.
 *
 * Мы сознательно отказались от фреймворка: приложение должно грузиться
 * на слабом канале сельской школы. Итог — ноль зависимостей, ноль сборки,
 * ~60 КБ на всё приложение. Здесь только то, что реально нужно:
 * безопасная шаблонная строка, делегирование событий и пара UI-примитивов.
 */

/** Экранирование — защита от XSS при подстановке пользовательских данных. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Тег-шаблон: значения экранируются автоматически.
 * Чтобы вставить готовый HTML, оберните значение в raw().
 */
export function html(strings, ...values) {
  return strings.reduce((out, str, i) => {
    const v = values[i - 1];
    const rendered = v === undefined || v === null || v === false ? ''
      : v && v.__raw ? v.value
      : Array.isArray(v) ? v.map((x) => (x && x.__raw ? x.value : esc(x))).join('')
      : esc(v);
    return out + rendered + str;
  });
}

export const raw = (value) => ({ __raw: true, value });

/** Простейший markdown для ответов репетитора: **жирный**, _курсив_, переносы. */
export function md(text) {
  return raw(
    esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
  );
}

/** Делегирование кликов по data-act — один слушатель на всё приложение. */
const handlers = new Map();
export function action(name, fn) { handlers.set(name, fn); }

export function initDelegation(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    /* Форма откликается на submit, а не на клик.
       Без этой строки любой клик ВНУТРИ формы всплывал до неё, находил на ней
       data-act и запускал отправку: щелчок по полю «Имя» сохранял анкету и
       уносил ученика на диагностику, а preventDefault на том же клике гасил
       обычное поведение поля. Форму нельзя заполнить, если каждое касание
       её отправляет. */
    if (el.tagName === 'FORM') return;
    const fn = handlers.get(el.dataset.act);
    if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  });
  root.addEventListener('submit', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = handlers.get(el.dataset.act);
    if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  });
}

export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

/**
 * Короткая выдержка из текста.
 *
 * Раньше многоточие приклеивалось безусловно, поэтому короткое описание,
 * и без того заканчивающееся точкой, выводилось как «…величины.…» — в вёрстке
 * это читалось четырьмя точками подряд. Режем только то, что длиннее нормы,
 * и по границе слова, а не посреди него.
 */
export function excerpt(text, max = 90) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:—-]+$/, '') + '…';
}

/** Кольцевой индикатор прогресса. Возвращает raw — вставляется внутрь других шаблонов. */
export function ring(pct, label, sub) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, pct)));
  return raw(html`
    <div class="ring">
      <svg viewBox="0 0 108 108" width="108" height="108" aria-hidden="true">
        <circle class="track" cx="54" cy="54" r="${String(r)}"></circle>
        <circle class="val" cx="54" cy="54" r="${String(r)}"
                stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle>
      </svg>
      <div class="ring-label"><b>${label}</b><span>${sub}</span></div>
    </div>`);
}

/** Полоса прогресса, окрашенная по уровню освоения. */
export function bar(pct, band) {
  return raw(html`<div class="bar bar-${band}"><i style="width:${(pct * 100).toFixed(0)}%"></i></div>`);
}

export const initials = (name) =>
  name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Озвучка — доступность для учеников с дислексией и слабым зрением. */
export function speak(text, locale) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
  return true;
}
