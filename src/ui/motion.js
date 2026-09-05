/**
 * Слой движения.
 *
 * Почему это отдельный модуль, а не пачка CSS-классов по месту.
 *
 * В приложении был прописан `transition: width .6s` на полосах прогресса и
 * `transition: stroke-dashoffset .8s` на кольце — но ни то, ни другое никогда
 * не срабатывало. Причина простая: элемент создаётся сразу с финальным
 * значением, а браузер анимирует только ИЗМЕНЕНИЕ значения. Мёртвый код,
 * который выглядел как работающая анимация.
 *
 * Здесь это чинится в одном месте: после каждой отрисовки элементы обнуляются,
 * прогоняется reflow, и значение возвращается — уже как переход.
 *
 * Правила, которых держимся:
 *   1. Движение объясняет структуру, а не украшает. Полоса растёт слева —
 *      потому что это прогресс. Блок всплывает снизу — потому что он новый.
 *   2. Ничего не двигается дольше 600 мс: это учебный инструмент, а не заставка.
 *   3. prefers-reduced-motion выключает всё до конца, а не «почти всё».
 *      Значения при этом выставляются сразу — интерфейс остаётся рабочим.
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Восстановить значение в следующем кадре — но не полагаясь только на rAF.
 *
 * Приём «обнулить → вернуть в rAF» — стандартный способ запустить переход,
 * и у него есть скрытая цена: в фоновой вкладке браузер останавливает rAF.
 * Если страница дорисовалась в фоне, обнуление уже произошло, а возврат —
 * нет, и полосы прогресса остаются на нуле. Показать ученику 0 % там, где
 * у него 74 %, — это не «пропала анимация», это ложные данные.
 *
 * Поэтому возврат вызывает тот, кто успел первым: два кадра или таймер.
 * Повторный вызов безвреден — присвоение того же значения ничего не меняет.
 */
function restoreSoon(apply) {
  let done = false;
  const run = () => { if (done) return; done = true; apply(); };
  requestAnimationFrame(() => requestAnimationFrame(run));
  setTimeout(run, 120);
}

/* ─── Полосы прогресса ─────────────────────────────────────────────────────
   Растут от нуля. Задержка по индексу даёт эффект «список наливается»,
   по которому глаз сам находит самую короткую полосу — то есть пробел. */
function animateBars(root) {
  const bars = root.querySelectorAll('.bar > i:not([data-animated])');
  bars.forEach((el, i) => {
    el.dataset.animated = '1';
    const target = el.style.width;
    if (!target || reduced()) return;
    el.style.width = '0%';
    el.style.transitionDelay = `${Math.min(i * 45, 400)}ms`;
    restoreSoon(() => { el.style.width = target; });
  });
}

/* ─── Кольцевой индикатор ──────────────────────────────────────────────────
   Дуга вычерчивается от нуля: видно, что число не нарисовано, а посчитано. */
function animateRings(root) {
  root.querySelectorAll('.ring .val:not([data-animated])').forEach((el) => {
    el.dataset.animated = '1';
    const target = el.getAttribute('stroke-dashoffset');
    const full = el.getAttribute('stroke-dasharray');
    if (target === null || reduced()) return;
    el.setAttribute('stroke-dashoffset', full);
    restoreSoon(() => el.setAttribute('stroke-dashoffset', target));
  });
}

/* ─── Счётчики ─────────────────────────────────────────────────────────────
   Крупные числа досчитываются до значения. Разделители и знаки сохраняются:
   «3,7 млн» так и остаётся «3,7 млн», меняется только числовая часть. */
function countUp(el) {
  const raw = el.textContent.trim();
  /* Разделитель тысяч засчитывается, только если за ним идут ровно три цифры
     («3 700», «1 200 000»). Иначе класс пробелов съедал обычный пробел перед
     словом, и «7 из 10» превращалось в «7из 10». */
  const match = raw.match(/^([^\d−-]*)(-?\d+(?:[\s  ]\d{3})*(?:[.,]\d+)?)(.*)$/s);
  if (!match) return;
  const [, before, numStr, after] = match;
  const decimals = (numStr.split(/[.,]/)[1] || '').length;
  const sep = numStr.includes(',') ? ',' : '.';
  const target = parseFloat(numStr.replace(/[\s  ]/g, '').replace(',', '.'));
  if (!isFinite(target)) return;

  const dur = 900;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    // easeOutExpo: быстро в начале, мягкая остановка — читается как «досчитал».
    const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    const v = (target * e).toFixed(decimals).replace('.', sep);
    el.textContent = before + v + after;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ─── Появление при прокрутке ──────────────────────────────────────────────
 *
 * Сознательно НЕ на IntersectionObserver.
 *
 * Схема «скрыть всё, показать по сигналу наблюдателя» имеет скверный режим
 * отказа: если сигнал не пришёл — а он не приходит в фоновой вкладке, в части
 * встроенных webview и в headless-браузерах, — контент навсегда остаётся с
 * opacity: 0. Страница выглядит пустой, и виноват в этом декоративный эффект.
 *
 * Здесь проверка положения делается вручную на прокрутке с троттлингом через
 * rAF (в кадре — одна проверка, независимо от числа событий), и есть страховка:
 * через 1,2 с всё, что попадает в окно, показывается принудительно. Худший
 * случай теперь — блок появился без анимации, а не исчез.
 */
const pending = new Set();
let queued = false;

/**
 * @param {Element} el
 * @param {boolean} instant  показать мгновенно, минуя переход
 *
 * instant нужен для аварийных путей (страховка по таймеру, печать). Обычный
 * показ добавляет класс и полагается на CSS-переход — а переход исполняет
 * компоновщик, и если он приторможен, элемент зависает на opacity 0 с уже
 * проставленным классом. Страховка не должна зависеть от того же механизма,
 * от сбоя которого она страхует, поэтому здесь переход отключается и элемент
 * просто становится видимым.
 */
function reveal(el, instant = false) {
  if (instant) el.style.transition = 'none';
  el.classList.add('in');
  if (el.hasAttribute('data-count')) countUp(el);
  pending.delete(el);
}

function sweep(force = false) {
  queued = false;
  const limit = window.innerHeight * (force ? 1 : 0.92);
  pending.forEach((el) => {
    if (!el.isConnected) { pending.delete(el); return; }
    if (el.getBoundingClientRect().top < limit) reveal(el);
  });
}

function scheduleSweep() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => sweep());
}

window.addEventListener('scroll', scheduleSweep, { passive: true });
window.addEventListener('resize', scheduleSweep, { passive: true });
// Первая страховка: видимое показывается, даже если rAF в этой вкладке
// приторможен (браузеры останавливают его в фоне).
setInterval(() => { if (pending.size) sweep(true); }, 1000);
// Печать не прокручивают: перед печатью показываем всё немедленно.
window.addEventListener('beforeprint', () => [...pending].forEach((el) => reveal(el, true)));

/**
 * Вторая страховка, жёсткая: через 6 секунд показать всё из этой партии,
 * где бы оно ни находилось.
 *
 * Именно «из партии», а не один общий таймер на модуль. С общим таймером
 * страховка срабатывала один раз при загрузке — и блоки, появившиеся позже
 * при переходе между экранами (например, плашки достижений в кабинете),
 * оставались скрытыми навсегда. Скрытый контент — цена, которую нельзя
 * платить за эффект появления.
 */
function guaranteeBatch(batch) {
  if (!batch.length) return;
  setTimeout(() => batch.forEach((el) => { if (pending.has(el)) reveal(el, true); }), 6000);
}

/**
 * Размечает то, что должно появляться при прокрутке.
 * Разметка проставляется здесь, а не в шаблонах страниц: иначе про неё
 * пришлось бы помнить в каждом новом блоке, и половина экранов её теряла бы.
 */
/**
 * Роли появления.
 *
 * Раньше здесь был плоский список селекторов, и всё на свете приходило
 * одинаково — «уехало на десять пикселей вниз и растворилось». Это самая
 * распространённая анимация в интернете, и именно поэтому она не читается
 * вообще: глаз перестал её замечать примерно в 2016 году.
 *
 * Теперь у каждого типа содержимого свой способ прийти, и способ этот
 * выведен из того, чем содержимое является:
 *
 *   head   — заголовок раздела ПЕЧАТАЕТСЯ: текст открывается снизу вверх
 *            из-под обреза, а разрядка надзаголовка садится с широкой на
 *            штатную. Типографский жест для типографского продукта.
 *   card   — карточка приподнимается, и по её верхней кромке ПРОЧЕРЧИВАЕТСЯ
 *            та самая световая линейка, которая и так есть в оформлении
 *            (.panel::after). Мы не добавляем украшение — мы оживляем деталь,
 *            которая уже была.
 *   row    — строка плана или риска въезжает слева: список раздаётся,
 *            как колода.
 *   stat   — число досчитывается (см. countUp) и приподнимается.
 *   chip   — мелкая плашка выскакивает с лёгким перелётом.
 *   media  — граф и тепловая карта открываются шторкой слева направо,
 *            как разворачивают лист.
 *
 * Порядок в массиве важен: элемент получает первую подошедшую роль, поэтому
 * частные селекторы идут раньше общих.
 */
const ROLES = [
  ['head',  ['.section-head', '.page-head']],
  ['stat',  ['.figures > div']],
  ['row',   ['.week', '.risk-row']],
  ['chip',  ['.badge', '.hero-meta', '.hero-cta']],
  ['media', ['.graph-shell', '.heat']],
  ['card',  ['.panel', '.steps > article', '.demo-card', '.faq details',
             '.versus > div', '.reco-item', '.sim-card']],
];

function markReveals(root) {
  const batch = [];

  ROLES.forEach(([role, selectors]) => {
    selectors.forEach((sel) => {
      root.querySelectorAll(sel).forEach((el, i) => {
        if (el.dataset.reveal) return;
        el.dataset.reveal = '1';
        el.dataset.in = role;
        if (reduced()) { el.classList.add('in'); return; }
        /* Ступенька внутри группы — не больше пяти шагов, иначе низ списка
           приходит слишком поздно и это читается как подтормаживание. */
        el.style.setProperty('--d', `${Math.min(i, 5) * 55}ms`);
        pending.add(el);
        batch.push(el);
      });
    });
  });

  root.querySelectorAll('.fig-num, .metric b').forEach((el) => {
    if (el.dataset.reveal) return;
    el.dataset.reveal = '1';
    el.setAttribute('data-count', '');
    if (reduced()) return;
    pending.add(el);
    batch.push(el);
  });

  // Первый проход сразу: то, что уже на экране, не должно ждать прокрутки —
  // иначе верх страницы встречает пользователя пустым.
  requestAnimationFrame(() => sweep());
  setTimeout(() => sweep(), 60);
  guaranteeBatch(batch);
}

/* ─── Тепловая карта класса ────────────────────────────────────────────────
   Ячейки проявляются волной по диагонали: за полсекунды глаз успевает
   заметить вертикальные красные полосы — то, ради чего таблица и нужна. */
function animateHeat(root) {
  if (reduced()) return;
  root.querySelectorAll('.heat tbody tr').forEach((tr, r) => {
    tr.querySelectorAll('td.cell').forEach((td, c) => {
      if (td.dataset.animated) return;
      td.dataset.animated = '1';
      td.style.setProperty('--d', `${Math.min((r + c) * 22, 620)}ms`);
      td.classList.add('cell-in');
    });
  });
}

/* ─── Граф знаний ──────────────────────────────────────────────────────────
   Рёбра прочерчиваются, узлы проявляются следом: сначала структура,
   потом состояние. Обратный порядок читался бы как россыпь точек. */
function animateGraph(root) {
  if (reduced()) return;
  const svg = root.querySelector('.graph-shell svg');
  if (!svg || svg.dataset.animated) return;
  svg.dataset.animated = '1';

  svg.querySelectorAll('.gedge').forEach((path, i) => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.style.transition = `stroke-dashoffset .55s var(--ease-out) ${Math.min(i * 24, 380)}ms`;
    restoreSoon(() => { path.style.strokeDashoffset = '0'; });
  });

  svg.querySelectorAll('.gnode').forEach((g, i) => {
    g.style.setProperty('--d', `${260 + Math.min(i * 34, 520)}ms`);
    g.classList.add('gnode-in');
  });
}

/** Вызывается после каждой отрисовки экрана. Идемпотентна. */
export function initMotion(root = document) {
  animateBars(root);
  animateRings(root);
  markReveals(root);
  animateHeat(root);
  animateGraph(root);
}
