/**
 * Бүркіт — публичный интерфейс талисмана.
 *
 * Это единственный файл, который импортируют экраны. Никто, кроме
 * `src/ui/mascot/`, не трогает разметку персонажа и не знает, чем он
 * нарисован: экран сообщает событие — `mascot.fire('correct')` — и на этом
 * его ответственность заканчивается. Благодаря этому обещанная в плане
 * замена SVG на Rive однажды сведётся к одному файлу рендерера, а не к
 * правкам в десяти экранах.
 *
 * Персонаж — один на приложение. Он не создаётся заново на каждой отрисовке
 * (а она в этом приложении происходит на каждый клик): элемент живёт в
 * модуле и переносится в гнездо нового экрана. Иначе после каждого ответа
 * персонаж «моргал» бы перезагрузкой и терял начатую анимацию.
 *
 * Гнездо экран объявляет разметкой:
 *   <div class="mascot-slot" data-mascot="learn" data-size="md"></div>
 * Экран без гнезда персонажа просто не показывает — так панель учителя
 * остаётся без мультфильма, и это осознанно: учителю нужны данные.
 */

import { rigSvg, ORIGINS, PART_IDS, POSES } from './mascot/rig.js';
import { bindParts, mode, applyPose, isCalm, arcFrames, play, reset, T, SPRING } from './mascot/anim.js';
import { createMachine } from './mascot/machine.js';
import { createIdle } from './mascot/idle.js';
import { say as speakBeak } from './mascot/speech.js';
import { stageOf, applyGrowth, STAGE_KEYS } from './mascot/growth.js';
import { feathers } from './juice.js';
import { speechLocale, t } from '../i18n.js';
import { getSettings } from '../state.js';

const PREFIX = 'm';

let inst = null;          // { el, parts, machine, idle }
let scene = null;         // какой экран сейчас держит персонажа
let floating = false;     // персонаж вынут в наложение и летает над страницей
let bubbleTimer = null;
let stopSpeech = null;
let stage = null;         // ступень роста; null — ещё не выставляли
let flightId = 0;         // счётчик полётов по цепочке: новый отменяет старый

/* ─── Создание ───────────────────────────────────────────────────────── */

function build() {
  const el = document.createElement('div');
  el.className = 'mascot';
  // Персонаж декоративен для скринридера. Всё, что он сообщает, обязано
  // быть сказано текстом экрана — это правило, а не упрощение.
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="mascot-bubble" hidden></div>${rigSvg(PREFIX)}`;

  const parts = bindParts(el, PART_IDS, ORIGINS, PREFIX);
  const idleRef = {};
  const machine = createMachine(parts, el, {
    onState: (name) => (name === 'idle' ? idleRef.current?.resume() : idleRef.current?.suspend()),
  });
  const idle = createIdle(parts, machine);
  idleRef.current = idle;
  idle.resume();

  return { el, parts, machine, idle };
}

function ensure() {
  if (mode() === 'off') return null;
  if (!inst) inst = build();
  return inst;
}

/** Совсем убрать персонажа — при переключении настройки в 'off'. */
function destroy() {
  if (!inst) return;
  inst.idle.stop();
  inst.machine.stop();
  inst.el.remove();
  inst = null;
  scene = null;
}

/** Снять с экрана, но сохранить состояние: следующий экран его подхватит. */
function park() {
  if (!inst || floating) return;
  inst.el.remove();
  scene = null;
}

/* ─── Наложение для полёта ───────────────────────────────────────────── */

let layerEl = null;
function layer() {
  if (layerEl && layerEl.isConnected) return layerEl;
  layerEl = document.createElement('div');
  layerEl.className = 'mascot-layer';
  layerEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layerEl);
  return layerEl;
}

/* ─── Публичный интерфейс ────────────────────────────────────────────── */

export const mascot = {
  /** Есть ли персонаж вообще (настройка 'off' и слабые устройства). */
  enabled: () => mode() !== 'off',
  calm: () => isCalm(),
  el: () => inst?.el || null,

  /**
   * Событие. Имена — из словаря состояний (`mascot/machine.js`).
   * Вызов на экране без персонажа молча ничего не делает: экранам не
   * приходится проверять настройку перед каждой реакцией.
   */
  fire(name, data) {
    if (mode() === 'off') return false;
    const i = ensure();
    if (!i || !i.el.isConnected) return false;
    return i.machine.fire(name, data);
  },

  /** Статичная поза без анимации — для режима calm и аварийных путей. */
  pose(name) {
    const i = ensure();
    if (!i || !POSES[name]) return;
    applyPose(i.parts, POSES[name], 300);
  },

  /**
   * Реплика: облачко над персонажем + движение клюва (+ озвучка, если она
   * включена учеником). Текст всегда приходит из словарей — персонаж
   * обязан говорить на языке интерфейса.
   */
  say(text, opts = {}) {
    const i = ensure();
    if (!i || !i.el.isConnected || !text) return;

    /* Длинный ответ репетитора в облачко не помещается и не нужен там: он
       уже написан в переписке. Персонаж в этом случае только шевелит клювом —
       «это говорю я», — а читает ученик текст. */
    const bubble = opts.bubble === false ? null : i.el.querySelector('.mascot-bubble');
    if (bubble) {
      bubble.textContent = text;
      bubble.hidden = false;
      bubble.classList.remove('in');
      requestAnimationFrame(() => bubble.classList.add('in'));
      clearTimeout(bubbleTimer);
      // Время на прочтение: 45 мс на знак, но не меньше двух секунд.
      bubbleTimer = setTimeout(() => {
        bubble.classList.remove('in');
        setTimeout(() => { bubble.hidden = true; }, 260);
      }, Math.max(2000, Math.min(7000, text.length * 45)));
    }

    stopSpeech?.();
    stopSpeech = speakBeak(i.parts, text, {
      locale: speechLocale(),
      // Вслух — только если ученик оставил озвучку включённой и сам попросил.
      tts: opts.aloud === true && getSettings().tts !== false,
      onWord: opts.onWord,
      onEnd: () => { stopSpeech = null; opts.onEnd?.(); },
    });
  },

  /** Прервать реплику — например, когда ученик ушёл с экрана. */
  hush() {
    stopSpeech?.();
    stopSpeech = null;
    const bubble = inst?.el.querySelector('.mascot-bubble');
    if (bubble) { bubble.hidden = true; bubble.classList.remove('in'); }
  },

  /* ─── Полёт над страницей ──────────────────────────────────────────
     Нужен онбордингу и экскурсии: персонаж перелетает от поля к полю
     и показывает, куда смотреть. В обычных экранах он сидит в гнезде и
     никуда не летает — летающий поверх контента персонаж мешает читать. */
  toLayer(size = 'md') {
    const i = ensure();
    if (!i) return;
    floating = true;
    // Снимаем «прибитый» transform: в полёте он и есть способ передвижения.
    i.el.style.removeProperty('transform');
    layer().appendChild(i.el);
    i.el.className = `mascot mascot-${size} mascot-floating`;
  },

  /** Перелететь к элементу (или к точке) по дуге. */
  flyTo(target, opts = {}) {
    const i = ensure();
    if (!i || !floating) return;
    const { side = 'auto', gap = 14 } = opts;

    const el = typeof target === 'string' ? document.querySelector(target) : target;
    const w = i.el.offsetWidth || 120;
    const h = i.el.offsetHeight || 150;

    let x = window.innerWidth / 2 - w / 2;
    let y = window.innerHeight / 2 - h / 2;

    if (el?.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      const left = r.left - w - gap;          // место слева от цели
      const right = r.right + gap;            // место справа от цели
      const fitsLeft = left >= 8;
      const fitsRight = right + w <= window.innerWidth - 8;

      /* Персонаж не имеет права закрывать собой то, на что показывает.
         Раньше здесь было «слева, если влезает, иначе справа» — и это
         «иначе» с прижатием к краю экрана сажало птицу ПРЯМО НА поле ввода:
         у широкого поля правого места нет, прижатая к краю координата
         попадала внутрь него. Кликам это не мешало (слой не ловит события),
         но поле было закрыто, и ученик просто не видел, что он печатает.

         Поэтому третий вариант: не влезло ни слева, ни справа — уходим НАД
         целью, а если и сверху нет места, то под ней. Так на любом экране
         персонаж остаётся рядом и ничего не перекрывает. */
      if (side === 'left' ? true : fitsLeft) {
        x = Math.max(8, left);
        y = r.top + r.height / 2 - h / 2;
      } else if (fitsRight) {
        x = right;
        y = r.top + r.height / 2 - h / 2;
      } else {
        x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
        const above = r.top - h - gap;
        y = above >= 8 ? above : r.bottom + gap;
      }

      x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
      y = Math.max(8, Math.min(y, window.innerHeight - h - 8));

      /* Прижатие к краям экрана могло снова надвинуть персонажа на поле —
         на низком окне «снизу» упирается в край и возвращается наверх. Здесь
         это проверяется прямо: если прямоугольники всё-таки пересеклись,
         перебираем углы, пока не найдётся свободный. Не нашлось ни одного —
         персонаж уходит в угол экрана. Пустой угол лучше закрытого поля. */
      const hits = (px, py) => !(px + w < r.left || px > r.right || py + h < r.top || py > r.bottom);
      if (hits(x, y)) {
        const maxX = window.innerWidth - w - 8;
        const maxY = window.innerHeight - h - 8;
        const spot = [
          [x, r.top - h - gap], [x, r.bottom + gap],
          [r.left - w - gap, y], [r.right + gap, y],
          [8, 8], [maxX, 8],
        ].find(([px, py]) => px >= 8 && px <= maxX && py >= 8 && py <= maxY && !hits(px, py));
        if (spot) { [x, y] = spot; } else { x = 8; y = 8; }
      }
    }

    const from = i.el._pos || { x, y: y + 40 };
    i.el._pos = { x, y };

    /* Мгновенный перенос — для прокрутки и поворота экрана: цель уехала, и
       догонять её по дуге было бы дёрганьем, а не полётом. */
    if (isCalm() || opts.instant) {
      i.el.style.transform = `translate(${x}px, ${y}px)`;
      return;
    }
    const frames = arcFrames(x - from.x, y - from.y, Math.min(90, Math.abs(x - from.x) * 0.35 + 30))
      .map((f) => T(`translate(${from.x}px, ${from.y}px) ${f.transform}`));
    frames.push(T(`translate(${x}px, ${y}px)`));
    play(i.el, frames, { duration: opts.duration ?? 680, easing: SPRING, fill: 'forwards' });

    // Крылья работают всё время перелёта — без них это переезжающий блок.
    play(i.parts.wingL, [T('rotate(0deg)'), T('rotate(-66deg)'), T('rotate(0deg)')], { duration: 240, iterations: 3, easing: 'ease-in-out' });
    play(i.parts.wingR, [T('rotate(0deg)'), T('rotate(66deg)'), T('rotate(0deg)')], { duration: 240, iterations: 3, easing: 'ease-in-out' });
  },

  /**
   * Рост персонажа по средней освоенности.
   *
   * Первый вызов за сессию только выставляет пропорции — молча. Праздновать
   * при каждой загрузке страницы то, что ученик заработал на прошлой неделе,
   * значит обесценить и праздник, и заработанное. Линька играется ровно один
   * раз: в тот момент, когда ступень выросла у него на глазах.
   */
  grow(avgMastery) {
    const i = ensure();
    if (!i) return;
    const next = stageOf(avgMastery);

    if (stage === null) { stage = next; applyGrowth(i.parts, next); return; }
    if (next <= stage) return;

    stage = next;
    i.machine.fire('molt');
    feathers(i.el, 7);
    // Новые пропорции появляются на пике дрожи, под перьями — так смена
    // силуэта читается как превращение, а не как подмена картинки.
    setTimeout(() => applyGrowth(i.parts, next), isCalm() ? 0 : 430);
    setTimeout(() => mascot.say(t(STAGE_KEYS[next])), isCalm() ? 0 : 900);
  },

  /** Текущая ступень роста — кабинету это нужно для подписи. */
  stage: () => stage,

  /**
   * Пролететь по цепочке элементов, задерживаясь у каждого.
   *
   * Существует ради одного экрана: на карте знаний персонаж проходит путь от
   * темы, которую ученик заваливает, до той, где всё сломалось на самом деле.
   * Этот путь — главный тезис продукта, и до сих пор он был текстом со
   * стрелочками. Теперь его можно увидеть: птица летит по рёбрам графа.
   */
  async flyPath(targets, opts = {}) {
    const i = ensure();
    if (!i || !targets?.length || isCalm()) return;

    const step = opts.step ?? 560;
    const hold = opts.hold ?? 420;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    flightId += 1;
    const my = flightId;
    const returning = !floating;
    if (returning) mascot.toLayer(opts.size || 'sm');

    for (const target of targets) {
      // Новый полёт (ученик нажал другой узел) отменяет старый: две птицы
      // на одной карте — это уже не объяснение, а карусель.
      if (my !== flightId) return;
      mascot.flyTo(target, { duration: step });
      await sleep(step);
      if (my !== flightId) return;
      i.machine.fire(opts.pose || 'point');
      await sleep(hold);
    }

    /* Сначала реакция на месте, и только потом возвращение. Если улететь
       сразу, вывод останется несказанным: ученик увидит перелёт, но не
       увидит, ЧТО персонаж нашёл в конце пути. */
    if (my !== flightId) return;
    opts.onDone?.();
    await sleep(opts.linger ?? 760);
    if (my !== flightId) return;
    if (returning) { mascot.land(); initMascot(document); }
  },

  /** Вернуть персонажа в обычный режим (в гнездо ближайшего экрана). */
  land() {
    if (!inst) { floating = false; return; }
    floating = false;
    /* Именно reset, а не очистка стиля: перелёт живёт с fill: 'forwards' и
       после посадки продолжал бы держать персонажа там, где тот приземлился,
       — то есть за краем экрана, вместе с горизонтальной прокруткой. */
    reset(inst.el);
    inst.el._pos = null;
    inst.el.className = 'mascot mascot-md';
    inst.el.remove();
    scene = null;
  },
};

/**
 * Вызывается после каждой отрисовки экрана, рядом с initMotion/initFlourish.
 *
 * Идемпотентна: если персонаж уже стоит в гнезде этого экрана, ничего не
 * происходит. Прилёт проигрывается только при смене экрана — иначе после
 * каждого выбранного варианта ответа персонаж влетал бы заново.
 */
export function initMascot(root = document) {
  if (mode() === 'off') { destroy(); return; }

  const slot = root.querySelector('[data-mascot]');
  const wantFloat = slot?.dataset.float === '1';

  // Ушли с экрана, который водил персонажа за руку, — возвращаем его на землю.
  // Иначе он остался бы висеть поверх следующего экрана.
  if (floating && !wantFloat) mascot.land();

  if (!slot) { park(); return; }

  const i = ensure();
  if (!i) return;

  const name = slot.dataset.mascot;
  const size = slot.dataset.size || 'md';
  const fresh = scene !== name;
  scene = name;

  if (wantFloat) {
    if (!floating) mascot.toLayer(size);
    /* Экран объявляет, к чему подлететь: data-anchor. Позиция считается в
       следующем кадре — до отрисовки у элементов ещё нет координат. */
    const anchor = slot.dataset.anchor;
    requestAnimationFrame(() => mascot.flyTo(anchor ? document.querySelector(anchor) : null));
    if (fresh && !isCalm()) i.machine.fire('enter');
    return;
  }

  i.el.className = `mascot mascot-${size}`;

  /* Жёсткий сброс на каждой посадке, а не только при смене гнезда.
     Персонаж, вернувшийся из полёта по карте знаний, приносит с собой
     смещение от последнего перелёта. Проверять «сменилось ли гнездо»
     недостаточно: полёт может закончиться в том же самом гнезде, и тогда
     смещение переживало посадку — птица висела в трёхстах пикселях от
     своего места и растягивала страницу вбок. Сидящий персонаж обязан
     стоять ровно там, где гнездо, и нигде больше; проверка тут дороже,
     чем безусловная отмена двух свойств. */
  reset(i.el);
  i.el._pos = null;
  if (i.el.parentElement !== slot) slot.appendChild(i.el);

  if (fresh) {
    if (isCalm()) applyPose(i.parts, POSES.neutral, 0);
    else i.machine.fire('enter');
  }
}
