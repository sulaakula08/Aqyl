/**
 * Слой отдачи: частицы, улетающий опыт, приседание кнопки, встряска, вибрация.
 *
 * Отдельно от motion.js и flourish.js, потому что это третий, самостоятельный
 * тип движения. В motion.js движение объясняет данные (полоса растёт — это
 * прогресс), во flourish.js — что элемент живой. Здесь движение отмечает
 * событие: ответ засчитан, блок закрыт, тема открылась.
 *
 * Главное правило слоя: отдача идёт ОТ причины К награде. Частицы вылетают
 * из нажатой кнопки, а не из персонажа, и опыт летит в счётчик опыта. Так
 * ученик без единого слова видит, что именно ему засчитали и куда это ушло.
 * Салют из центра экрана красив ровно один раз и не объясняет ничего.
 *
 * Всё это — украшение по определению, поэтому весь файл обязан молча
 * ничего не делать в режиме calm. Информация о результате живёт в тексте
 * разбора, а не здесь.
 */

import { isCalm, mode, hitstop } from './mascot/anim.js';

export { hitstop };

/** Общий слой поверх интерфейса. Один на приложение, создаётся при первом же событии. */
let layer = null;
function fxLayer() {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  return layer;
}

/**
 * Потолок на число живых частиц.
 *
 * Ученик может отвечать быстрее, чем гаснут предыдущие частицы, а на слабом
 * телефоне полторы сотни анимированных элементов — это уже пропущенные кадры
 * ровно в тот момент, когда на экране появляется разбор ошибки. Двадцать
 * четыре хватает на полноценный залп, и больше их одновременно не бывает.
 */
const MAX_PARTICLES = 24;
let live = 0;

const centerOf = (target) => {
  if (!target) return { x: innerWidth / 2, y: innerHeight / 2 };
  if (target.getBoundingClientRect) {
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return target;
};

/**
 * Залп частиц из элемента.
 * @param {Element|{x:number,y:number}} origin  откуда — обычно нажатая кнопка
 */
export function burst(origin, opts = {}) {
  if (isCalm()) return;
  const { count = 12, spread = 120, color = 'var(--accent-bright)', power = 1 } = opts;
  const { x, y } = centerOf(origin);
  const host = fxLayer();

  const n = Math.max(0, Math.min(count, MAX_PARTICLES - live));
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'fx-dot';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = color;
    p.style.borderRadius = Math.random() < 0.4 ? '50%' : '2px';
    host.appendChild(p);
    live += 1;

    const angle = (-90 + (Math.random() - 0.5) * spread) * Math.PI / 180;
    const dist = (55 + Math.random() * 85) * power;
    const dx = Math.cos(angle) * dist;
    // Частица летит вверх и падает: без притяжения залп читается как звёздочки.
    const dy = Math.sin(angle) * dist;

    p.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * .7}px), calc(-50% + ${dy}px)) rotate(${(Math.random() - .5) * 420}deg) scale(.85)`, opacity: 1, offset: .55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 46}px)) rotate(${(Math.random() - .5) * 620}deg) scale(.35)`, opacity: 0 },
    ], { duration: 680 + Math.random() * 340, easing: 'cubic-bezier(.2,.6,.3,1)' })
      .finished.catch(() => {}).then(() => { p.remove(); live -= 1; });
  }
}

/**
 * Число летит от кнопки к счётчику.
 *
 * Смысл не в красоте: начисленный опыт и место, где он хранится, — это две
 * точки экрана, между которыми ученик иначе не проводит связи. Если цели на
 * экране нет (счётчик спрятан в мобильном меню), число просто всплывает
 * вверх и гаснет — так же понятно, только без адреса.
 */
export function flyTo(from, to, text) {
  if (isCalm() || !text) return;
  const a = centerOf(from);
  const host = fxLayer();

  const chip = document.createElement('span');
  chip.className = 'fx-fly';
  chip.textContent = text;
  chip.style.left = `${a.x}px`;
  chip.style.top = `${a.y}px`;
  host.appendChild(chip);

  const target = typeof to === 'string' ? document.querySelector(to) : to;
  const b = target ? centerOf(target) : { x: a.x, y: a.y - 90 };

  chip.animate([
    { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: .18 },
    { transform: `translate(calc(-50% + ${(b.x - a.x) * .5}px), calc(-50% + ${(b.y - a.y) * .5 - 26}px)) scale(1)`, opacity: 1, offset: .6 },
    { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.55)`, opacity: 0 },
  ], { duration: 1000, easing: 'cubic-bezier(.3,.7,.2,1)' })
    .finished.catch(() => {}).then(() => chip.remove());
}

/**
 * Приседание кнопки: scaleX и scaleY в противоход, объём сохраняется.
 * Равномерное сжатие читается как «элемент интерфейса уменьшился»,
 * противоход — как «по нему стукнули».
 */
export function squash(el, strength = 1) {
  if (!el || isCalm()) return;
  el.animate([
    { transform: 'scale(1,1)' },
    { transform: `scale(${1 + .06 * strength}, ${1 - .07 * strength})` },
    { transform: `scale(${1 - .02 * strength}, ${1 + .03 * strength})` },
    { transform: 'scale(1,1)' },
  ], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
}

/**
 * Встряска — только для крупных событий: закрытый блок, открытая тема.
 * На ошибке её нет никогда: тряска в ответ на ошибку читается как наказание.
 */
export function shake(el, px = 2.5) {
  if (!el || isCalm()) return;
  el.animate([
    { transform: 'translate(0,0)' },
    { transform: `translate(${px}px, ${-px}px)` },
    { transform: `translate(${-px}px, ${px * .5}px)` },
    { transform: `translate(${px * .6}px, 0)` },
    { transform: 'translate(0,0)' },
  ], { duration: 170, easing: 'ease-out' });
}

/* ─── Обводка от руки ──────────────────────────────────────────────────────
 *
 * Верный вариант не просто подсвечивается цветом — его обводят, как это
 * делает учитель карандашом в тетради. Линия рисуется на глазах (за 420 мс)
 * и намеренно неровная: идеальный эллипс читается как элемент интерфейса,
 * кривоватый — как чужая рука, которая только что прошлась по твоей работе.
 *
 * Дрожание детерминировано: оно выводится из текста внутри элемента, а не из
 * Math.random(). При перерисовке экрана — а она здесь происходит на каждый
 * клик — обводка обязана лечь той же линией, иначе она «дёргается» на месте
 * и превращается в дефект.
 */

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/**
 * Три росчерка одной рукой.
 *
 * `circle` — обвёл верный ответ, `strike` — зачеркнул неверный, `underline` —
 * подчеркнул подсказку. Все три рисуются одним и тем же дрожащим пером и
 * одинаково «доезжают» за край: это должно читаться как одна рука, а не как
 * три разных эффекта. Зачёркивание при этом идёт цветом пробела, а не
 * красной ручкой поверх работы: мы отмечаем неверный вариант, а не ставим
 * ученику оценку.
 */
function strikePath(w, h, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const y = h / 2;
  const pts = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Линия начинается чуть раньше края и заканчивается чуть за ним.
    const x = -6 + (w + 12) * t;
    pts.push([x, y + Math.sin(t * 5 + seed % 4) * 2.4 + (rnd() - 0.5) * 1.6 - (t - 0.5) * 3]);
  }
  return 'M' + pts.map(([x, y2]) => `${x.toFixed(1)} ${y2.toFixed(1)}`).join(' L');
}

function underlinePath(w, h, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const y = h - 3;
  const pts = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([2 + (w - 4) * t, y + Math.sin(t * 6 + seed % 5) * 1.8 + (rnd() - 0.5) * 1.2]);
  }
  return 'M' + pts.map(([x, y2]) => `${x.toFixed(1)} ${y2.toFixed(1)}`).join(' L');
}

function ellipsePath(w, h, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  const cx = w / 2, cy = h / 2;
  const rx = w / 2 - 3, ry = h / 2 - 2;
  const pts = [];
  // Перелёт за начальную точку: рука не останавливается ровно там, где начала.
  const from = -0.35, to = Math.PI * 2 + 0.55;
  const steps = 34;
  for (let i = 0; i <= steps; i++) {
    const a = from + (to - from) * (i / steps);
    // Радиус гуляет на несколько процентов, и гуляет плавно — по синусу,
    // а не по независимому случаю на каждой точке, иначе получается пила.
    const wob = 1 + Math.sin(a * 3 + seed % 6) * 0.035 + (rnd() - 0.5) * 0.02;
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
  }
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
}

export function scribble(el, opts = {}) {
  if (!el || isCalm()) return;
  const w0 = el.offsetWidth;
  const h0 = el.offsetHeight;
  if (!w0 || !h0) return;

  const pad = opts.pad ?? 6;
  const w = w0 + pad * 2;
  const h = h0 + pad * 2;
  const seed = hash(el.textContent || 'x');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'fx-scribble');
  svg.setAttribute('viewBox', `0 0 ${w.toFixed(0)} ${h.toFixed(0)}`);
  /* Обводка живёт ВНУТРИ обведённого элемента, а не в общем слое поверх
     страницы. Координаты вьюпорта здесь не годятся: сразу после проверки
     ответа появляется блок разбора, вёрстка съезжает вниз — и линия,
     посчитанная мгновением раньше, остаётся висеть в пустоте под вариантом.
     Ребёнку это читается как «система обвела не тот ответ», то есть эффект
     не украшает, а врёт. Внутри элемента линия едет вместе с ним всегда. */
  svg.style.left = `${-pad}px`;
  svg.style.top = `${-pad}px`;
  svg.style.width = `${w}px`;
  svg.style.height = `${h}px`;

  const kind = opts.kind || 'circle';
  const draw = kind === 'strike' ? strikePath : kind === 'underline' ? underlinePath : ellipsePath;
  const COLOR = { circle: 'var(--band-mastered)', strike: 'var(--band-gap)', underline: 'var(--accent)' };

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', draw(w, h, seed));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', opts.color || COLOR[kind]);
  path.setAttribute('stroke-width', kind === 'circle' ? '2.4' : '2.2');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
  // Кнопке варианта нужна точка отсчёта; статичной она бывает по умолчанию.
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.appendChild(svg);

  const len = path.getTotalLength();
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(len);
  // Черта короче обводки — и проводится быстрее: рука не выводит зачёркивание
  // так же старательно, как кружок вокруг правильного ответа.
  path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
    { duration: kind === 'circle' ? 460 : 280, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' });

  // Линия живёт ровно столько, сколько ученик смотрит на разбор.
  setTimeout(() => {
    svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' })
      .finished.catch(() => {}).then(() => svg.remove());
  }, opts.hold ?? 2600);
}

/* ─── Перья ────────────────────────────────────────────────────────────────
 *
 * Два повода: смена крупного раздела и линька персонажа. Перо — это подпись
 * продукта, а не эффект: другого способа сказать «здесь только что был
 * беркут» у нас нет, а говорить это текстом было бы нелепо.
 *
 * Летит оно как настоящее — не падает по прямой, а качается из стороны в
 * сторону и переворачивается. Прямое падение читается как ошибка вёрстки.
 */
const FEATHER = `<svg viewBox="0 0 12 26" aria-hidden="true">
  <path d="M6 0C10 7 11 15 6 26 1 15 2 7 6 0z" fill="var(--accent)"/>
  <path d="M6 3v20" stroke="var(--accent-bright)" stroke-width=".9" fill="none"/>
</svg>`;

export function feathers(origin = null, count = 5) {
  if (isCalm()) return;
  const host = fxLayer();
  const start = origin ? centerOf(origin) : null;

  for (let i = 0; i < Math.min(count, 8); i++) {
    const f = document.createElement('i');
    f.className = 'fx-feather';
    f.innerHTML = FEATHER;
    const x = start ? start.x + (Math.random() - 0.5) * 70 : Math.random() * innerWidth;
    const y = start ? start.y + (Math.random() - 0.5) * 40 : -30;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    host.appendChild(f);

    const drift = (Math.random() - 0.5) * 160;
    const fall = start ? innerHeight - y + 40 : innerHeight + 60;
    const spin = (Math.random() - 0.5) * 260;

    f.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 0 },
      { transform: `translate(${(drift * .3).toFixed(0)}px, ${(fall * .18).toFixed(0)}px) rotate(${(spin * .3).toFixed(0)}deg)`, opacity: 1, offset: .18 },
      { transform: `translate(${(drift * .75).toFixed(0)}px, ${(fall * .6).toFixed(0)}px) rotate(${(spin * .8).toFixed(0)}deg)`, opacity: 1, offset: .62 },
      { transform: `translate(${drift.toFixed(0)}px, ${fall.toFixed(0)}px) rotate(${spin.toFixed(0)}deg)`, opacity: 0 },
    ], {
      duration: 2200 + Math.random() * 1400,
      delay: i * 90,
      easing: 'cubic-bezier(.35,.1,.5,1)',
    }).finished.catch(() => {}).then(() => f.remove());
  }
}

/**
 * Вибрация. На Android это половина ощущения «попал», на остальных — тихо
 * ничего. Отдельно от звука: вибрацию не слышит сосед по парте.
 */
export function haptic(pattern) {
  if (mode() === 'off') return;
  try { navigator.vibrate?.(pattern); } catch { /* устройство не умеет */ }
}
