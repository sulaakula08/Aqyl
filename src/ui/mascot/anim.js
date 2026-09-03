/**
 * Движок анимации талисмана.
 *
 * Всё держится на Web Animations API и ни на одной внешней библиотеке.
 * Причина та же, по которой в проекте нет сборки: каждый килобайт здесь —
 * это секунды загрузки на школьном интернете, а `element.animate()` умеет
 * ровно то, что нужно персонажу: отмену на лету, композицию по частям и
 * произвольную кривую скорости.
 *
 * Три вещи, ради которых этот файл вообще существует:
 *
 *   1. Пружина. Мультяшность — это перелёт и возврат, а не «плавно доехал».
 *      Кубическая кривая перелёта не даёт вовсе, поэтому здесь честный
 *      затухающий осциллятор, посчитанный в 26 точек и отданный браузеру
 *      строкой `linear(...)`. Физика без физического движка.
 *
 *   2. Отмена от текущей позы. Ученик нажимает «Далее», не досмотрев
 *      празднование; если просто запустить следующую анимацию, персонаж
 *      прыгнет. Здесь предыдущая анимация коммитится в текущее положение
 *      и только потом отменяется — переход получается непрерывным.
 *
 *   3. Режим «calm». При prefers-reduced-motion и на слабом устройстве
 *      персонаж не исчезает — он мгновенно принимает конечную позу.
 *      Выражение остаётся, движение пропадает. Это разные вещи.
 */

import { getSettings } from '../../state.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Слабое устройство определяется один раз при загрузке.
 *
 * Проверять на каждом кадре нечего: память и число ядер не меняются, а
 * saveData ученик включает не посреди урока. Пороги подобраны под реальное
 * устройство нашего пользователя — телефон на 2–3 ГБ с четырьмя ядрами:
 * он тянет интерфейс, но частицы и одновременные пружины на нём заметно
 * подтормаживают, и лучше отдать ему спокойного персонажа, чем дёрганого.
 */
const weakDevice = (() => {
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  const saveData = navigator.connection?.saveData;
  return Boolean(saveData || (mem && mem < 4) || (cores && cores <= 4));
})();

/** Аварийный выключатель из адреса: ?mascot=off — на случай чужого проектора. */
const urlOverride = new URLSearchParams(location.search).get('mascot');

/** 'full' | 'calm' | 'off' — единственный источник правды о режиме. */
export function mode() {
  if (urlOverride === 'off' || urlOverride === 'calm' || urlOverride === 'full') return urlOverride;
  const s = getSettings();
  if (s.mascot === 'off') return 'off';
  if (s.mascot === 'calm' || s.reducedMotion || reduced() || weakDevice) return 'calm';
  return 'full';
}

export const isCalm = () => mode() !== 'full';

/* ─── Пружина ──────────────────────────────────────────────────────────────
   Затухающий осциллятор, посчитанный заранее и записанный как linear().
   Считается один раз на строку: браузеру всё равно, а нам не нужен рантайм
   физики ради шести кривых. */
const springCache = new Map();

export function spring(stiffness = 190, damping = 14, mass = 1, steps = 26) {
  const key = `${stiffness}|${damping}|${mass}|${steps}`;
  if (springCache.has(key)) return springCache.get(key);

  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = w0 * Math.sqrt(Math.abs(1 - zeta * zeta));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 1.1;
    const v = zeta < 1
      ? 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t))
      : 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    pts.push(v.toFixed(4));
  }
  const css = `linear(${pts.join(',')})`;
  springCache.set(key, css);
  return css;
}

/**
 * Готовые кривые. Больше четырёх — уже разнобой.
 *
 * POP — самая жёсткая: почти мгновенный набор с одним коротким перелётом и
 * без раскачки. Ею играется реакция на верный ответ, и это осознанный выбор
 * характера: мягкая пружина читается как «мультик про зверушку», жёсткая —
 * как уверенный отклик инструмента, который знает, что делает. Разница
 * между «мило» и «дорого» на глаз измеряется именно здесь.
 */
export const SPRING = spring(210, 13);
export const SOFT = spring(120, 18);
export const SNAP = spring(320, 20);
export const POP = spring(420, 21);
export const EASE = 'cubic-bezier(.16,1,.3,1)';

/* ─── Проигрывание ─────────────────────────────────────────────────────── */

/** Что сейчас крутится на каждом элементе. WeakMap — чтобы не держать DOM. */
const running = new WeakMap();

/** Хелпер: кадр из строки трансформации. */
export const T = (transform) => ({ transform });

/**
 * Запустить анимацию на части персонажа.
 *
 * Новая анимация всегда вытесняет старую на этой же части: очередей нет
 * принципиально. Очередь означала бы, что персонаж доигрывает вчерашнюю
 * радость поверх сегодняшней ошибки, а ученик в это время ждёт.
 */
export function play(el, frames, opts = {}) {
  if (!el) return null;

  const prev = running.get(el);
  if (prev) {
    // Зафиксировать текущее положение и только потом отменить: иначе часть
    // прыгает в исходную позу за один кадр до старта новой анимации.
    try { prev.commitStyles(); } catch { /* элемент уже вне документа */ }
    prev.cancel();
  }

  if (isCalm()) {
    const last = frames[frames.length - 1];
    if (last && last.transform) el.style.transform = last.transform;
    if (last && last.opacity !== undefined) el.style.opacity = last.opacity;
    return null;
  }

  const anim = el.animate(frames, {
    duration: opts.duration ?? 500,
    easing: opts.easing ?? SPRING,
    delay: opts.delay ?? 0,
    fill: opts.fill ?? 'none',
    iterations: opts.iterations ?? 1,
    direction: opts.direction ?? 'normal',
    composite: opts.composite ?? 'replace',
  });
  running.set(el, anim);
  anim.finished.catch(() => {}).then(() => { if (running.get(el) === anim) running.delete(el); });
  return anim;
}

/**
 * Жёсткий сброс элемента: снять анимацию, НЕ фиксируя позу, и стереть
 * инлайновый transform.
 *
 * Нужен там, где персонаж возвращается из полёта. Анимация перелёта живёт с
 * `fill: 'forwards'` — то есть продолжает применять смещение и после того,
 * как доиграла. Простая очистка `style.transform` его не отменяет: элемент
 * визуально остаётся за пределами экрана и раздвигает страницу, добавляя
 * горизонтальную прокрутку на ровном месте.
 */
export function reset(el) {
  if (!el) return;
  const a = running.get(el);
  if (a) { a.cancel(); running.delete(el); }
  el.getAnimations?.().forEach((x) => x.cancel());
  el.style.transform = '';
}

/** Снять всё, что играет на этих частях, оставив их там, где застали. */
export function cancelAll(parts) {
  Object.values(parts).forEach((el) => {
    const a = running.get(el);
    if (!a) return;
    try { a.commitStyles(); } catch { /* элемент уже вне документа */ }
    a.cancel();
    running.delete(el);
  });
}

/**
 * Перевести персонажа в статичную позу.
 * `ms = 0` — мгновенно (режим calm, печать, аварийные пути).
 */
export function applyPose(parts, poseObj, ms = 320) {
  Object.entries(poseObj).forEach(([part, transform]) => {
    const el = parts[part];
    if (!el) return;
    if (!ms || isCalm()) {
      const a = running.get(el);
      if (a) { a.cancel(); running.delete(el); }
      el.style.transform = transform;
      return;
    }
    play(el, [T(transform)], { duration: ms, easing: SOFT, fill: 'forwards' });
  });
}

/* ─── Дуга ─────────────────────────────────────────────────────────────────
   Персонаж не ездит по прямой. Прямой перенос читается как «поехал блок
   интерфейса», дуга — как «перелетел живой». Квадратичная кривая Безье,
   разложенная в кадры: WAAPI не умеет motion-path в кадрах, но двенадцати
   точек достаточно, чтобы глаз увидел дугу. */
export function arcFrames(dx, dy, lift = 60, steps = 12) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = dx * t;
    // Подъём максимален посередине пути и обнуляется на концах.
    const y = dy * t - lift * 4 * t * (1 - t);
    const tilt = (1 - Math.abs(0.5 - t) * 2) * (dx > 0 ? 8 : -8);
    out.push(T(`translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg)`));
  }
  return out;
}

/* ─── Хит-стоп ────────────────────────────────────────────────────────────
   Приём из игр: в момент удара всё замирает на несколько десятков
   миллисекунд, и только потом продолжает. Стоит ноль, а вес события
   продаёт лучше любой дополнительной анимации. */
export function hitstop(ms = 45) {
  if (isCalm()) return;
  const anims = document.getAnimations?.() || [];
  const paused = anims.filter((a) => a.playState === 'running');
  paused.forEach((a) => a.pause());
  setTimeout(() => paused.forEach((a) => { try { a.play(); } catch { /* уже снята */ } }), ms);
}

/* ─── Фоновая вкладка ──────────────────────────────────────────────────────
   В скрытой вкладке браузер и сам придерживает кадры, но зацикленные
   анимации продолжают числиться активными и будят процессор. Персонажа,
   которого никто не видит, анимировать незачем — это прямая трата батареи
   на телефоне, который ученик носит весь день. */
const loops = new Set();

export function registerLoop(anim) {
  if (!anim) return anim;
  loops.add(anim);
  anim.finished.catch(() => {}).then(() => loops.delete(anim));
  return anim;
}

document.addEventListener('visibilitychange', () => {
  loops.forEach((a) => {
    try { document.hidden ? a.pause() : a.play(); } catch { loops.delete(a); }
  });
});

/** Привязать части оснастки к DOM и проставить точки вращения. */
export function bindParts(root, ids, origins, prefix = 'm') {
  const parts = {};
  ids.forEach((id) => {
    const el = root.querySelector(`#${prefix}-${id}`);
    if (!el) return;
    el.style.transformBox = 'fill-box';
    el.style.transformOrigin = origins[id] || '50% 50%';
    parts[id] = el;
  });
  return parts;
}
