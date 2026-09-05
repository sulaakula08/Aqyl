/**
 * Состояния Бүркіта.
 *
 * Словарь состояний — это контракт между персонажем и всем остальным
 * приложением. Экран учёбы не знает, как выглядит радость: он сообщает
 * `correct`, и на этом его ответственность заканчивается. Поэтому список
 * ниже расширяется осознанно, а не по случаю: каждое новое состояние
 * придётся поддерживать во всех рендерерах, включая будущий Rive.
 *
 * Бюджет движения (жёсткий):
 *   фон/ожидание   ≤ 400 мс
 *   реакция        ≤ 700 мс
 *   празднование   ≤ 1400 мс
 * Всё прерываемо. Очередей нет: новая реакция вытесняет старую, а не ждёт
 * её конца — иначе персонаж радуется вчерашнему ответу поверх сегодняшнего.
 *
 * Приоритеты решают спор двух одновременных событий:
 *   0 — фон (idle, look, sleep)
 *   1 — сопровождение (think, hint, point)
 *   2 — реакция на ответ (correct, oops, proud, worried, unlock, wake)
 *   3 — событие (celebrate, sad, enter, exit)
 * Реакция с приоритетом ниже текущей просто теряется. Это правильно:
 * подсказка, пришедшая посреди празднования, никому не нужна.
 */

import { play, applyPose, cancelAll, registerLoop, T, SPRING, SOFT, SNAP, POP, isCalm } from './anim.js';
import { POSES } from './rig.js';
import { burst, shake } from '../juice.js';

const PRIORITY = {
  idle: 0, look: 0, sleep: 0,
  think: 1, hint: 1, point: 1,
  correct: 2, nearMiss: 2, oops: 2, proud: 2, worried: 2, unlock: 2, wake: 2, nod: 2,
  celebrate: 3, sad: 3, enter: 3, exit: 3, molt: 3,
};

/**
 * Спокойный режим: что персонаж показывает вместо движения.
 *
 * Без этой таблицы «calm» означал бы «персонаж есть, но всегда с одним
 * лицом»: анимация реакции заканчивается в позе покоя, и мгновенный переход
 * к её последнему кадру не показывал бы ничего. Ученик, которому вредно
 * движение, не обязан лишаться того, что персонаж сообщает позой, — поэтому
 * здесь каждой реакции сопоставлено выражение, а не пустота.
 */
const CALM_POSE = {
  correct: 'happy', proud: 'happy', celebrate: 'wow', unlock: 'wow',
  nearMiss: 'worried', oops: 'worried', worried: 'worried',
  hint: 'point', point: 'point', think: 'think',
  sad: 'sad', sleep: 'sleep', molt: 'wow',
};

/** Сколько персонаж держит состояние, прежде чем вернуться к покою. */
const HOLD = {
  correct: 780, nearMiss: 820, oops: 1150, proud: 900, worried: 1000,
  unlock: 950, celebrate: 1500, sad: 1600, hint: 1900, point: 2400,
  enter: 760, wake: 480, nod: 460, molt: 1700,
};

export function createMachine(parts, host, hooks = {}) {
  let current = 'idle';
  let holdTimer = null;
  let sleeping = false;
  const lastVariant = {};

  /** Вариант реакции, но не тот же, что в прошлый раз. */
  const pick = (key, n) => {
    let v;
    do { v = Math.floor(Math.random() * n); } while (n > 1 && v === lastVariant[key]);
    lastVariant[key] = v;
    return v;
  };

  const brows = (l, r, y = 0, ms = 260) => {
    play(parts.browL, [T(`rotate(${l}deg) translateY(${y}px)`)], { duration: ms, easing: SOFT, fill: 'forwards' });
    play(parts.browR, [T(`rotate(${r}deg) translateY(${y}px)`)], { duration: ms, easing: SOFT, fill: 'forwards' });
  };

  /**
   * Тень под прыжок. Чем выше персонаж, тем меньше и бледнее пятно контакта.
   * Это не физика, а её убедительная подделка: без неё прыжок читается как
   * «фигура уехала вверх», с ней — как отталкивание от земли.
   */
  const shadowJump = (peak = 0.72, ms = 700, delay = 0) => {
    play(parts.shadow, [
      { transform: 'scale(1,1)', opacity: 1 },
      { transform: 'scale(1.14,1.1)', opacity: 1, offset: .12 },
      { transform: `scale(${peak},${peak * 0.9})`, opacity: .45, offset: .45 },
      { transform: 'scale(1.06,1.04)', opacity: 1, offset: .82 },
      { transform: 'scale(1,1)', opacity: 1 },
    ], { duration: ms, delay, easing: SPRING });
  };

  const wings = (l, r, ms = 500, delay = 0) => {
    play(parts.wingL, [T(`rotate(${l}deg)`)], { duration: ms, delay, easing: SPRING, fill: 'forwards' });
    play(parts.wingR, [T(`rotate(${r}deg)`)], { duration: ms, delay, easing: SPRING, fill: 'forwards' });
  };

  const TRIGGERS = {
    /* ─── Покой ─────────────────────────────────────────────────────────
       Не «пустая» реакция: сюда персонаж возвращается после каждой,
       и именно здесь он снова начинает дышать, моргать и смотреть. */
    idle() {
      sleeping = false;
      applyPose(parts, POSES.neutral, 320);
      play(parts.zzz, [{ opacity: 0 }], { duration: 200, fill: 'forwards' });
      return 0;
    },

    /* ─── Прилёт и уход ─────────────────────────────────────────────────
       По дуге, не по прямой: прямой перенос читается как переезд блока
       интерфейса, дуга — как живое существо. */
    enter() {
      applyPose(parts, POSES.neutral, 0);
      /* fill: 'forwards' здесь обязателен. Предыдущим состоянием мог быть
         `exit` — персонаж улетел за край и там же зафиксирован. Без явного
         закрепления конечной позы прилёт доиграл бы и вернул его обратно
         за экран, то есть экран остался бы без персонажа. */
      play(parts.root, [
        T('translate(-90px, 46px) rotate(-14deg) scale(.82)'),
        T('translate(-20px, -18px) rotate(6deg) scale(1.04)'),
        T('translate(0,0) rotate(0deg) scale(1)'),
      ], { duration: 720, easing: SPRING, fill: 'forwards' });
      const beat = { duration: 260, iterations: 3, easing: 'ease-in-out' };
      play(parts.shadow, [{ transform: 'scale(.5,.5)', opacity: .3 }, { transform: 'scale(1,1)', opacity: 1 }],
        { duration: 720, easing: SPRING });
      play(parts.wingL, [T('rotate(0deg)'), T('rotate(-64deg)'), T('rotate(0deg)')], beat);
      play(parts.wingR, [T('rotate(0deg)'), T('rotate(64deg)'), T('rotate(0deg)')], beat);
      play(parts.crest, [T('rotate(14deg) scaleY(.8)'), T('rotate(0deg) scaleY(1)')], { duration: 700, delay: 90, easing: SPRING, fill: 'forwards' });
      return HOLD.enter;
    },

    exit() {
      play(parts.root, [
        T('translate(0,0) rotate(0deg) scale(1)'),
        T('translate(18px, 14px) rotate(-8deg) scale(.96)'),
        T('translate(120px, -70px) rotate(16deg) scale(.7)'),
      ], { duration: 560, easing: 'cubic-bezier(.4,0,.9,.5)', fill: 'forwards' });
      const beat = { duration: 190, iterations: 3, easing: 'ease-in-out' };
      play(parts.wingL, [T('rotate(0deg)'), T('rotate(-72deg)'), T('rotate(0deg)')], beat);
      play(parts.wingR, [T('rotate(0deg)'), T('rotate(72deg)'), T('rotate(0deg)')], beat);
      return 0;
    },

    /* ─── Верный ответ ──────────────────────────────────────────────────
       Три вещи подряд, и порядок важен: сначала подготовка — приседание
       в сторону, ОБРАТНУЮ движению, потом прыжок с растяжением, потом
       возврат с перелётом. Без приседания это «блок подпрыгнул».
       Хохолок и хвост опаздывают на 8 и 14 % длительности — этим
       персонаж и отличается от иконки. */
    correct(data = {}) {
      const streak = data.streak || 0;
      const big = streak >= 3;
      const v = pick('correct', 3);

      brows(-9, 9, -2, 180);
      /* Пауза на пике (два одинаковых кадра подряд, offset .42 и .5) — приём
         из рисованной анимации: движение читается не по траектории, а по
         остановке в крайней точке. Без неё прыжок «проскакивает», и глаз
         не успевает поймать позу. */
      play(parts.body, [
        { transform: 'translateY(0) scale(1,1)', offset: 0 },
        { transform: 'translateY(6px) scale(1.14,.88)', offset: .16 },
        { transform: `translateY(${big ? -28 : -16}px) scale(.9,1.12)`, offset: .42 },
        { transform: `translateY(${big ? -26 : -15}px) scale(.93,1.09)`, offset: .5 },
        { transform: 'translateY(0) scale(1.07,.94)', offset: .78 },
        { transform: 'translateY(0) scale(1,1)', offset: 1 },
      ], { duration: 620, easing: POP });
      play(parts.head, [
        T('rotate(0deg) translateY(0)'),
        T(`rotate(${v === 1 ? 5 : -5}deg) translateY(-9px)`),
        T('rotate(0deg) translateY(0)'),
      ], { duration: 620, delay: 50, easing: POP });
      play(parts.crest, [
        T('rotate(0deg) scaleY(1)'),
        T(`rotate(${v === 1 ? 14 : -14}deg) scaleY(1.34)`),
        T('rotate(0deg) scaleY(1)'),
      ], { duration: 660, delay: 86, easing: POP });
      play(parts.tail, [T('rotate(0deg)'), T('rotate(8deg)'), T('rotate(0deg)')], { duration: 700, delay: 98, easing: SPRING });

      const lift = big ? 70 : v === 0 ? 54 : 40;
      play(parts.wingL, [T('rotate(0deg)'), T(`rotate(${-lift}deg)`), T('rotate(0deg)')], { duration: 620, delay: 32, easing: POP });
      play(parts.wingR, [T('rotate(0deg)'), T(`rotate(${lift}deg)`), T('rotate(0deg)')], { duration: 620, delay: 32, easing: POP });

      shadowJump(big ? 0.58 : 0.74, 620);
      if (big) burst(host, { count: 12, spread: 140 });
      return HOLD.correct;
    },

    /* ─── Кивок ─────────────────────────────────────────────────────────
       Самая дешёвая реакция в наборе: «принял». Нужна там, где ученик
       делает выбор, а не отвечает, — в анкете, в плане, в настройках.
       Радоваться выбранному предмету так же, как решённой задаче, значит
       обесценить решённую задачу. */
    nod() {
      const v = pick('nod', 2);
      play(parts.head, [
        T('rotate(0deg) translateY(0)'),
        T(`rotate(${v ? 4 : -4}deg) translateY(3px)`),
        T('rotate(0deg) translateY(0)'),
      ], { duration: 440, easing: SPRING });
      play(parts.crest, [T('rotate(0deg) scaleY(1)'), T(`rotate(${v ? -8 : 8}deg) scaleY(1.12)`), T('rotate(0deg) scaleY(1)')], { duration: 460, delay: 60, easing: SPRING });
      return HOLD.nod;
    },

    /* ─── Почти верно ───────────────────────────────────────────────────
       Отдельное состояние, а не «та же ошибка». Ученик, выбравший соседний
       вариант, ошибся иначе, чем ученик, ткнувший наугад, — и персонаж,
       который это различает, воспринимается как понимающий, а не как
       автомат с двумя лампочками. */
    nearMiss() {
      brows(11, -3, 1);
      play(parts.body, [
        T('translateY(0) scale(1,1)'),
        T('translateY(-7px) scale(.96,1.05)'),
        T('translateY(2px) scale(1.03,.97)'),
        T('translateY(0) scale(1,1)'),
      ], { duration: 700, easing: SOFT });
      play(parts.head, [T('rotate(0deg)'), T('rotate(-13deg)'), T('rotate(2deg)'), T('rotate(0deg)')], { duration: 740, delay: 50, easing: SOFT });
      play(parts.crest, [T('rotate(0deg) scaleY(1)'), T('rotate(-16deg) scaleY(1.12)'), T('rotate(0deg) scaleY(1)')], { duration: 760, delay: 90, easing: SOFT });
      play(parts.wingL, [T('rotate(0deg)'), T('rotate(-46deg)'), T('rotate(0deg)')], { duration: 720, delay: 60, easing: SPRING });
      return HOLD.nearMiss;
    },

    /* ─── Ошибка ────────────────────────────────────────────────────────
       Вздрагивание, а затем указание на причину. Персонаж не хмурится на
       ученика: наши пользователи — школьники, которым и без нас достаточно
       сказали, что они отстают. Разочарование здесь запрещено продуктовым
       решением, а не вкусом. */
    oops() {
      const v = pick('oops', 2);
      brows(14, -14, 2);
      play(parts.body, [
        T('translateX(0) scale(1,1)'),
        T('translateX(-6px) scale(1.07,.93)'),
        T('translateX(4px) scale(.99,1.01)'),
        T('translateX(0) scale(1,1)'),
      ], { duration: 620, easing: SOFT });
      play(parts.head, [T('rotate(0deg)'), T(`rotate(${v ? -10 : -6}deg)`), T('rotate(4deg)'), T('rotate(0deg)')], { duration: 660, delay: 50, easing: SOFT });
      play(parts.crest, [T('rotate(0deg) scaleY(1)'), T('rotate(15deg) scaleY(.72)'), T('rotate(6deg) scaleY(.9)')], { duration: 700, delay: 90, easing: SOFT, fill: 'forwards' });
      // Крыло остаётся вытянутым: персонаж показывает на разбор внизу.
      play(parts.wingR, [T('rotate(0deg)'), T('rotate(-36deg)'), T('rotate(-28deg)')], { duration: 700, delay: 180, easing: SPRING, fill: 'forwards' });
      return HOLD.oops;
    },

    /* ─── Подсказка ─────────────────────────────────────────────────────
       Наклон к экрану и вытянутое крыло: «смотри сюда». Держится дольше
       остальных реакций, потому что ученик в этот момент читает. */
    hint() {
      applyPose(parts, POSES.point, 420);
      return HOLD.hint;
    },

    point() {
      applyPose(parts, POSES.point, 420);
      return HOLD.point;
    },

    /* ─── Размышление ───────────────────────────────────────────────────
       Заменяет спиннер у репетитора. Зациклено — значит, обязано вставать
       на паузу в скрытой вкладке, поэтому идёт через registerLoop. */
    think() {
      brows(-13, 6, 1);
      applyPose(parts, { crest: 'rotate(9deg) scaleY(.8)' }, 420);
      registerLoop(play(parts.head, [
        T('rotate(0deg)'), T('rotate(11deg)'), T('rotate(7deg)'), T('rotate(11deg)'), T('rotate(0deg)'),
      ], { duration: 2800, iterations: Infinity, easing: 'ease-in-out' }));
      registerLoop(play(parts.feet, [
        T('translateY(0)'), T('translateY(-2px)'), T('translateY(0)'),
      ], { duration: 900, iterations: Infinity, easing: 'ease-in-out' }));
      return 0;
    },

    /* ─── Празднование ──────────────────────────────────────────────────
       Единственное место, где разрешены взлёт, конфетти и встряска. Если
       праздновать каждый верный ответ, к третьему блоку это перестанет
       что-либо значить — награду надо копить, а не тратить. */
    celebrate() {
      brows(-12, 12, -3);
      play(parts.body, [
        T('translateY(0) scale(1,1)'),
        T('translateY(7px) scale(1.14,.86)'),
        T('translateY(-48px) scale(.9,1.14)'),
        T('translateY(-30px) scale(1,1)'),
        T('translateY(0) scale(1.08,.92)'),
        T('translateY(0) scale(1,1)'),
      ], { duration: 1300, easing: SPRING });
      play(parts.head, [T('translateY(0) rotate(0deg)'), T('translateY(-13px) rotate(-6deg)'), T('translateY(0) rotate(0deg)')], { duration: 1300, delay: 70, easing: SPRING });
      play(parts.crest, [T('scaleY(1) rotate(0deg)'), T('scaleY(1.42) rotate(-16deg)'), T('scaleY(1) rotate(0deg)')], { duration: 1340, delay: 120, easing: SPRING });
      play(parts.tail, [T('rotate(0deg)'), T('rotate(-11deg)'), T('rotate(0deg)')], { duration: 780, delay: 140, easing: SPRING });
      const beat = { duration: 420, iterations: 3, easing: 'ease-in-out' };
      play(parts.wingL, [T('rotate(0deg)'), T('rotate(-72deg)'), T('rotate(0deg)')], beat);
      play(parts.wingR, [T('rotate(0deg)'), T('rotate(72deg)'), T('rotate(0deg)')], beat);

      shadowJump(0.34, 1300);
      burst(host, { count: 18, spread: 150, power: 1.15 });
      setTimeout(() => burst(host, { count: 10, spread: 200, color: 'var(--band-strong)' }), 240);
      shake(host, 2.5);
      return HOLD.celebrate;
    },

    /* ─── Линька ────────────────────────────────────────────────────────
       Момент, когда персонаж переходит на следующую ступень роста.
       Сначала мелкая дрожь — это подготовка, без неё превращение выглядит
       как подмена картинки. На пике дрожи наружу летят перья (их пускает
       вызывающая сторона), и уже под ними разворачивается новый размах
       крыльев. Играется от силы четыре раза за всё обучение — поэтому ей
       можно позволить полторы секунды. */
    molt() {
      const shiver = [];
      for (let i = 0; i < 9; i++) shiver.push(T(`translateX(${i % 2 ? 2.4 : -2.4}px) rotate(${i % 2 ? 1.6 : -1.6}deg)`));
      shiver.push(T('translateX(0) rotate(0deg)'));
      play(parts.body, shiver, { duration: 520, easing: 'linear' });
      play(parts.head, [T('translateY(0)'), T('translateY(3px)'), T('translateY(-14px)'), T('translateY(0)')], { duration: 1500, easing: SPRING });

      // Крылья разворачиваются во всю ширину — именно в этот момент ученик
      // видит, что они стали длиннее.
      play(parts.wingL, [T('rotate(0deg)'), T('rotate(-8deg)'), T('rotate(-84deg)'), T('rotate(-20deg)'), T('rotate(0deg)')],
        { duration: 1500, delay: 380, easing: SPRING });
      play(parts.wingR, [T('rotate(0deg)'), T('rotate(8deg)'), T('rotate(84deg)'), T('rotate(20deg)'), T('rotate(0deg)')],
        { duration: 1500, delay: 380, easing: SPRING });
      play(parts.crest, [T('rotate(0deg) scaleY(1)'), T('rotate(0deg) scaleY(.6)'), T('rotate(0deg) scaleY(1.6)'), T('rotate(0deg) scaleY(1)')],
        { duration: 1560, delay: 420, easing: SPRING });
      play(parts.tail, [T('rotate(0deg)'), T('rotate(-14deg)'), T('rotate(0deg)')], { duration: 1500, delay: 460, easing: SPRING });
      brows(-10, 10, -2, 600);
      shadowJump(0.82, 1500, 380);
      shake(host, 2);
      return HOLD.molt;
    },

    /* ─── Открытая тема ─────────────────────────────────────────────────
       Персонаж подаёт новую тему крылом — жест «вот, держи», а не «ура». */
    unlock() {
      brows(-6, 10, -1);
      play(parts.body, [T('translateY(0) scale(1,1)'), T('translateY(-10px) scale(.96,1.06)'), T('translateY(0) scale(1,1)')], { duration: 820, easing: SPRING });
      play(parts.head, [T('rotate(0deg)'), T('rotate(-8deg)'), T('rotate(0deg)')], { duration: 860, delay: 60, easing: SPRING });
      play(parts.wingR, [T('rotate(0deg)'), T('rotate(-64deg)'), T('rotate(-40deg)')], { duration: 880, delay: 90, easing: SPRING, fill: 'forwards' });
      burst(host, { count: 9, spread: 90 });
      return HOLD.unlock;
    },

    /* ─── Гордость ──────────────────────────────────────────────────────
       Грудь вперёд, хохолок во всю высоту. Для роста уровня и решённой
       сложной задачи: это про ученика, а не про интерфейс. */
    proud() {
      brows(-7, 7, -2);
      play(parts.body, [T('scale(1,1)'), T('scale(1.06,1.04) translateY(-3px)'), T('scale(1.02,1.02) translateY(-2px)')], { duration: 820, easing: SPRING, fill: 'forwards' });
      play(parts.head, [T('rotate(0deg) translateY(0)'), T('rotate(0deg) translateY(-5px)')], { duration: 820, delay: 60, easing: SPRING, fill: 'forwards' });
      play(parts.crest, [T('rotate(0deg) scaleY(1)'), T('rotate(0deg) scaleY(1.35)')], { duration: 860, delay: 110, easing: SPRING, fill: 'forwards' });
      wings(-16, 16, 700, 80);
      return HOLD.proud;
    },

    /* ─── Тревога ───────────────────────────────────────────────────────
       Для найденного пробела и приближающегося экзамена. Смотрит туда,
       где проблема, а не на ученика. */
    worried() {
      applyPose(parts, POSES.worried, 480);
      return HOLD.worried;
    },

    /* ─── Прерванная серия ──────────────────────────────────────────────
       Один тихий такт грусти — и всё. Дальше экран обязан предложить
       ближайший маленький шаг. Мы не строим на чувстве вины: это дети. */
    sad() {
      applyPose(parts, POSES.sad, 560);
      play(parts.body, [T('translateY(0) scale(1,1)'), T('translateY(4px) scale(1.04,.95)')], { duration: 620, easing: SOFT, fill: 'forwards' });
      return HOLD.sad;
    },

    /* ─── Сон и пробуждение ─────────────────────────────────────────────
       Через две минуты без ученика анимировать некому — персонаж засыпает
       и перестаёт тратить батарею. Просыпается вздрогнув: это единственное
       место, где резкая пружина уместна. */
    sleep() {
      sleeping = true;
      applyPose(parts, POSES.sleep, 800);
      if (!isCalm()) {
        registerLoop(play(parts.zzz, [
          { opacity: 0, transform: 'translateY(4px)' },
          { opacity: 1, transform: 'translateY(-5px)' },
        ], { duration: 1700, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', fill: 'forwards' }));
      }
      return 0;
    },

    wake() {
      sleeping = false;
      play(parts.zzz, [{ opacity: 0 }], { duration: 150, fill: 'forwards' });
      applyPose(parts, POSES.neutral, 260);
      play(parts.body, [T('scale(1,1)'), T('scale(.9,1.12)'), T('scale(1,1)')], { duration: 420, easing: SNAP });
      play(parts.crest, [T('rotate(0deg) scaleY(1)'), T('rotate(-18deg) scaleY(1.4)'), T('rotate(0deg) scaleY(1)')], { duration: 460, delay: 40, easing: SNAP });
      return HOLD.wake;
    },
  };

  function fire(name, data) {
    const trigger = TRIGGERS[name];
    if (!trigger) return false;

    // Спящего сначала будим — иначе реакция играет поверх закрытых глаз.
    if (sleeping && name !== 'sleep') {
      TRIGGERS.wake();
      if (name === 'wake') { current = 'wake'; return true; }
    }

    const now = PRIORITY[current] ?? 0;
    const next = PRIORITY[name] ?? 0;
    // Приоритет ниже текущего — реакция теряется. Очередей нет намеренно.
    if (holdTimer && next < now) return false;

    clearTimeout(holdTimer);
    holdTimer = null;
    current = name;
    /* Фоновая жизнь (дыхание, взгляд, микродвижения) живёт на тех же частях,
       что и реакции, поэтому её нельзя оставлять включённой во время реакции:
       две анимации на одном элементе — это гонка, а не композиция. Отсюда
       уведомление наружу на каждой смене состояния. */
    hooks.onState?.(name);

    /* В спокойном режиме реакция — это смена выражения без единого перехода.
       Таймер возврата к покою при этом остаётся: выражение обязано сходить
       с лица, иначе персонаж навсегда останется встревоженным. */
    if (isCalm()) {
      sleeping = name === 'sleep';
      applyPose(parts, POSES[CALM_POSE[name] || 'neutral'], 0);
      const wait = HOLD[name];
      if (wait) {
        holdTimer = setTimeout(() => {
          holdTimer = null;
          if (current === name) { current = 'idle'; hooks.onState?.('idle'); applyPose(parts, POSES.neutral, 0); }
        }, wait);
      }
      return true;
    }

    const hold = trigger(data || {});
    if (hold) {
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (current === name) { current = 'idle'; hooks.onState?.('idle'); TRIGGERS.idle(); }
      }, hold);
    }
    return true;
  }

  return {
    fire,
    current: () => current,
    isSleeping: () => sleeping,
    stop() {
      clearTimeout(holdTimer);
      holdTimer = null;
      cancelAll(parts);
    },
  };
}
