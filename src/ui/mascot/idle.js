/**
 * Фоновая жизнь персонажа.
 *
 * Это та часть, которую обычно не делают, — и ровно из-за неё талисман либо
 * живой, либо наклейка. Реакции на ответы занимают в сумме секунды; всё
 * остальное время ученик видит паузу между реакциями, и именно она решает,
 * воспринимается ли персонаж как существо.
 *
 * Правила фона:
 *   • ничего не повторяется по метроному — моргание идёт по случайному
 *     интервалу, микродвижения выбираются из пула без повторов подряд;
 *   • взгляд следует за указателем, голова — на треть амплитуды и с
 *     задержкой, иначе получается не внимание, а слежка;
 *   • скука нарастает: полминуты — посмотрел на тебя, минута — на задание,
 *     две — уснул. Спящий персонаж ничего не анимирует, то есть перестаёт
 *     тратить батарею телефона, который ученик носит весь день;
 *   • фон уступает всему остальному: как только приходит реакция, фон
 *     выключается целиком, а не пытается доиграть под ней.
 */

import { play, registerLoop, isCalm, T, SOFT, SPRING } from './anim.js';

const BLINK_MIN = 1600;
const BLINK_SPREAD = 5200;
const MICRO_MIN = 6000;
const MICRO_SPREAD = 8000;

const BORED_LOOK = 30_000;
const BORED_NUDGE = 60_000;
const BORED_SLEEP = 120_000;

export function createIdle(parts, machine) {
  let active = false;
  let stopped = false;
  const loops = [];
  let blinkTimer = null;
  let microTimer = null;
  let boredTimer = null;
  let rafId = null;
  let lastMicro = -1;
  let gx = 0, gy = 0;

  /* ─── Дыхание ────────────────────────────────────────────────────────
     Полтора процента по вертикали. Голова опаздывает на 180 мс — сама по
     себе эта задержка и создаёт ощущение веса. */
  function breathe() {
    loops.push(registerLoop(play(parts.body, [
      T('scale(1,1)'), T('scale(.988,1.014)'), T('scale(1,1)'),
    ], { duration: 3400, iterations: Infinity, easing: 'ease-in-out' })));
    loops.push(registerLoop(play(parts.head, [
      T('translateY(0)'), T('translateY(-1.6px)'), T('translateY(0)'),
    ], { duration: 3400, delay: 180, iterations: Infinity, easing: 'ease-in-out' })));
  }

  /* ─── Моргание ───────────────────────────────────────────────────────
     Интервал случайный, иногда двойное моргание. Равномерное моргание
     раз в четыре секунды глаз замечает и читает как механизм. */
  function blink() {
    if (stopped) return;
    if (active && !machine.isSleeping() && !isCalm()) {
      const double = Math.random() < 0.15;
      const frames = double
        ? [T('scaleY(0)'), T('scaleY(1)'), T('scaleY(0)'), T('scaleY(1)'), T('scaleY(0)')]
        : [T('scaleY(0)'), T('scaleY(1)'), T('scaleY(0)')];
      play(parts.lids, frames, { duration: double ? 430 : 190, easing: 'ease-out' });
    }
    blinkTimer = setTimeout(blink, BLINK_MIN + Math.random() * BLINK_SPREAD);
  }

  /* ─── Взгляд ─────────────────────────────────────────────────────────
     Координаты пишутся слушателем, а двигает зрачки один rAF-цикл: так
     на телефоне не появляется работы на каждое движение пальца. */
  const onPoint = (e) => {
    const r = hostRect();
    if (!r) return;
    gx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2));
    gy = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2));
    touch();
  };

  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const hostRect = () => parts.root?.ownerSVGElement?.getBoundingClientRect();

  function gazeLoop() {
    rafId = requestAnimationFrame(gazeLoop);
    if (!active || machine.isSleeping() || isCalm()) return;
    if (machine.current() !== 'idle') return;
    if (parts.pupils) parts.pupils.style.transform = `translate(${(gx * 2.6).toFixed(2)}px, ${(gy * 2).toFixed(2)}px)`;
    // Голова — на треть амплитуды. Отдельное свойство rotate, а не transform:
    // transform в этот момент принадлежит дыханию, и спорить за него нельзя.
    if (parts.head) parts.head.style.rotate = `${(gx * 4).toFixed(2)}deg`;
  }

  /* ─── Микродвижения ──────────────────────────────────────────────────
     Пул мелких жестов. Никакой смысловой нагрузки — только доказательство,
     что персонаж не замер. Подряд один и тот же не выпадает. */
  const MICRO = [
    // Почесал голову крылом.
    () => {
      play(parts.wingR, [T('rotate(0deg)'), T('rotate(-52deg)'), T('rotate(-44deg)'), T('rotate(0deg)')], { duration: 900, easing: SOFT });
      play(parts.head, [T('rotate(0deg)'), T('rotate(4deg)'), T('rotate(0deg)')], { duration: 900, easing: SOFT });
    },
    // Отвёл взгляд и вернул.
    () => {
      play(parts.pupils, [T('translate(0,0)'), T('translate(3px,-1px)'), T('translate(3px,-1px)'), T('translate(0,0)')], { duration: 1100, easing: 'ease-in-out' });
    },
    // Встряхнул хохолком.
    () => {
      play(parts.crest, [T('rotate(0deg) scaleY(1)'), T('rotate(-14deg) scaleY(1.15)'), T('rotate(8deg) scaleY(.95)'), T('rotate(0deg) scaleY(1)')], { duration: 760, easing: SPRING });
    },
    // Подпрыгнул на месте.
    () => {
      play(parts.body, [T('translateY(0) scale(1,1)'), T('translateY(3px) scale(1.05,.95)'), T('translateY(-7px) scale(.97,1.04)'), T('translateY(0) scale(1,1)')], { duration: 700, easing: SPRING });
      play(parts.tail, [T('rotate(0deg)'), T('rotate(5deg)'), T('rotate(0deg)')], { duration: 760, delay: 90, easing: SPRING });
    },
    // Переступил лапами.
    () => {
      play(parts.feet, [T('translateX(0)'), T('translateX(2px)'), T('translateX(-2px)'), T('translateX(0)')], { duration: 800, easing: 'ease-in-out' });
      play(parts.body, [T('rotate(0deg)'), T('rotate(1.5deg)'), T('rotate(-1.5deg)'), T('rotate(0deg)')], { duration: 800, easing: 'ease-in-out' });
    },
    // Клюнул экран изнутри — как будто там, снаружи, что-то интересное.
    () => {
      play(parts.head, [
        T('translateY(0) scale(1,1)'), T('translateY(-2px) scale(1.02,.98)'),
        T('translateY(5px) scale(1.06,.94)'), T('translateY(0) scale(1,1)'),
        T('translateY(4px) scale(1.05,.95)'), T('translateY(0) scale(1,1)'),
      ], { duration: 900, easing: 'ease-in-out' });
      play(parts.beakBottom, [T('rotate(0deg)'), T('rotate(16deg)'), T('rotate(0deg)'), T('rotate(14deg)'), T('rotate(0deg)')],
        { duration: 900, easing: 'ease-in-out' });
    },
    // Зевнул.
    () => {
      play(parts.beakBottom, [T('rotate(0deg)'), T('rotate(22deg)'), T('rotate(0deg)')], { duration: 1000, easing: SOFT });
      play(parts.lids, [T('scaleY(0)'), T('scaleY(.7)'), T('scaleY(0)')], { duration: 1000, easing: SOFT });
    },
  ];

  function micro() {
    if (stopped) return;
    if (active && !isCalm() && !machine.isSleeping() && machine.current() === 'idle') {
      let i;
      do { i = Math.floor(Math.random() * MICRO.length); } while (i === lastMicro);
      lastMicro = i;
      MICRO[i]();
      // Дыхание сбилось анимацией на тех же частях — восстанавливаем.
      setTimeout(() => { if (active && machine.current() === 'idle') restartBreath(); }, 1200);
    }
    microTimer = setTimeout(micro, MICRO_MIN + Math.random() * MICRO_SPREAD);
  }

  function restartBreath() {
    loops.forEach((a) => { try { a.cancel(); } catch { /* уже снята */ } });
    loops.length = 0;
    if (!isCalm()) breathe();
  }

  /* ─── Скука ──────────────────────────────────────────────────────────
     Три ступени. Последняя — сон: персонаж, которого не трогают две
     минуты, обязан замолчать сам, а не ждать, пока его выключат. */
  function scheduleBoredom() {
    clearTimeout(boredTimer);
    if (!active || isCalm()) return;
    boredTimer = setTimeout(() => {
      if (!active || machine.current() !== 'idle') return;
      MICRO[1]();                                    // посмотрел на ученика
      boredTimer = setTimeout(() => {
        if (!active || machine.current() !== 'idle') return;
        // Взгляд вниз, на задание: подсказка телом, а не текстом.
        play(parts.head, [T('rotate(0deg)'), T('rotate(6deg) translateY(2px)'), T('rotate(0deg)')], { duration: 1400, easing: SOFT });
        play(parts.pupils, [T('translate(0,0)'), T('translate(0,2.4px)'), T('translate(0,0)')], { duration: 1400, easing: SOFT });
        boredTimer = setTimeout(() => {
          if (active && machine.current() === 'idle') machine.fire('sleep');
        }, BORED_SLEEP - BORED_NUDGE);
      }, BORED_NUDGE - BORED_LOOK);
    }, BORED_LOOK);
  }

  /** Любой признак жизни ученика: движение, клавиша, касание. */
  function touch() {
    if (!active) return;
    if (machine.isSleeping()) machine.fire('wake');
    scheduleBoredom();
  }

  function resume() {
    if (stopped || isCalm()) return;
    active = true;
    restartBreath();
    scheduleBoredom();
  }

  function suspend() {
    active = false;
    clearTimeout(boredTimer);
    loops.forEach((a) => { try { a.cancel(); } catch { /* уже снята */ } });
    loops.length = 0;
    if (parts.head) parts.head.style.rotate = '';
    if (parts.pupils) parts.pupils.style.transform = '';
  }

  /* ─── Наклон против ветра ────────────────────────────────────────────
     Быстрая прокрутка страницы для персонажа — это встречный поток: он
     наклоняется навстречу движению и выпрямляется, когда страница встала.
     Мелочь ценой в десять строк, но именно из таких мелочей складывается
     ощущение, что существо находится в мире, а не приклеено к нему.
     Наклон идёт в отдельное свойство `rotate` — `transform` в этот момент
     принадлежит реакциям, и спорить с ними нельзя. */
  let lastY = window.scrollY;
  let lean = 0;
  let leanRaf = null;

  const relax = () => {
    lean *= 0.86;
    if (parts.root) parts.root.style.rotate = `${lean.toFixed(2)}deg`;
    leanRaf = Math.abs(lean) > 0.05 ? requestAnimationFrame(relax) : null;
    if (!leanRaf && parts.root) parts.root.style.rotate = '';
  };

  const onScroll = () => {
    if (isCalm() || !parts.root) return;
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    // Порог: медленное чтение персонажа не качает.
    if (Math.abs(dy) < 6) return;
    lean = Math.max(-7, Math.min(7, lean - dy * 0.12));
    if (!leanRaf) leanRaf = requestAnimationFrame(relax);
  };

  document.addEventListener('pointermove', onPoint, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('keydown', touch, { passive: true });
  document.addEventListener('pointerdown', touch, { passive: true });

  blink();
  micro();
  gazeLoop();

  return {
    resume,
    suspend,
    touch,
    stop() {
      stopped = true;
      suspend();
      clearTimeout(blinkTimer);
      clearTimeout(microTimer);
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(leanRaf);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointermove', onPoint);
      document.removeEventListener('keydown', touch);
      document.removeEventListener('pointerdown', touch);
    },
  };
}
