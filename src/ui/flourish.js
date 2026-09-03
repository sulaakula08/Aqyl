/**
 * Декоративный слой: подсветка курсором и бегущая строка.
 *
 * Отдельно от motion.js намеренно. Там движение объясняет данные — полоса
 * растёт, потому что это прогресс. Здесь движение объясняет только то, что
 * элемент живой и на него можно нажать. Смешивать эти два слоя нельзя:
 * иначе однажды кто-нибудь «оптимизирует» анимацию прогресса вместе
 * с декором и сломает показ настоящих чисел.
 *
 * Палитра не расширяется: подсветка — это тот же акцентный золотой,
 * разведённый до 8 % непрозрачности. Никаких вторых цветов и свечения.
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── Подсветка курсором ───────────────────────────────────────────────────
   Карточка узнаёт, где указатель, и рисует под ним мягкое пятно на рамке.
   Координаты пишутся в CSS-переменные, всё остальное делает CSS: JS не
   трогает стили каждого кадра, поэтому это не нагружает слабый ноутбук. */

let spotlightBound = false;

function bindSpotlight() {
  if (spotlightBound || reduced()) return;
  spotlightBound = true;

  // Один слушатель на документ вместо слушателя на каждой карточке:
  // карточек на главной под два десятка, и столько подписок на pointermove
  // — заметная нагрузка на телефоне.
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // Уводя курсор, гасим пятно, иначе оно застывает там, где его бросили.
  document.addEventListener('pointerleave', (e) => {
    const card = e.target.closest?.('.spot');
    if (card) card.style.removeProperty('--mx');
  }, { passive: true, capture: true });
}

/** Помечает карточки, которым положена подсветка. */
function markSpotlights(root) {
  root.querySelectorAll('.panel, .steps > article, .figures > div, .sim-card')
    .forEach((el) => el.classList.add('spot'));
}

/* ─── Бегущая строка ───────────────────────────────────────────────────────

   Замедление при наведении сделано на requestAnimationFrame, а не на
   animation-play-state: пауза срабатывает мгновенно и читается как рывок,
   а `animation-duration` в переходах не интерполируется вовсе. Здесь
   скорость — обычное число, которое плавно доводится до целевого.        */

const marquees = new Set();
let rafId = null;

function tick() {
  let alive = false;

  marquees.forEach((m) => {
    if (!m.el.isConnected) { marquees.delete(m); return; }
    alive = true;

    // Экспоненциальное сближение с целевой скоростью: замедление и разгон
    // получаются одинаково мягкими, без единой строчки таймингов.
    m.speed += (m.target - m.speed) * 0.055;
    m.x -= m.speed;

    // Лента продублирована ровно один раз, поэтому сброс на её половине
    // незаметен: следующий кадр показывает точно такую же картинку.
    if (m.x <= -m.half) m.x += m.half;
    m.track.style.transform = `translate3d(${m.x.toFixed(2)}px,0,0)`;
  });

  rafId = alive ? requestAnimationFrame(tick) : null;
}

function initMarquees(root) {
  root.querySelectorAll('.marquee:not([data-init])').forEach((el) => {
    el.dataset.init = '1';
    const track = el.querySelector('.marquee-track');
    if (!track) return;

    // Дублируем содержимое: бесконечность — это две одинаковые половины.
    track.innerHTML += track.innerHTML;
    track.setAttribute('aria-hidden', 'false');

    if (reduced()) return;   // Ничего не двигаем — лента просто стоит.

    const base = Number(el.dataset.speed) || 0.42;
    const m = { el, track, x: 0, speed: base, target: base, half: track.scrollWidth / 2 };
    marquees.add(m);

    el.addEventListener('pointerenter', () => { m.target = base * 0.18; });
    el.addEventListener('pointerleave', () => { m.target = base; });
    // Клавиатурный фокус внутри ленты — тоже причина притормозить.
    el.addEventListener('focusin', () => { m.target = base * 0.18; });
    el.addEventListener('focusout', () => { m.target = base; });

    // Ширина половины меняется при смене языка и повороте телефона.
    new ResizeObserver(() => { m.half = track.scrollWidth / 2; }).observe(track);

    if (!rafId) rafId = requestAnimationFrame(tick);
  });
}

/** Вызывается после каждой отрисовки экрана. */
export function initFlourish(root = document) {
  bindSpotlight();
  markSpotlights(root);
  initMarquees(root);
}
