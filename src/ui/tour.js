/**
 * Первое знакомство: подсвечиваем разделы прямо на живом интерфейсе.
 *
 * Почему не модальное окно с текстом «добро пожаловать». Ученик, впервые
 * открывший платформу, не читает описания — он ищет, куда нажать. Экскурсия
 * по настоящему экрану отвечает ровно на этот вопрос и заканчивается там,
 * где начинается работа.
 *
 * Экскурсия обязана быть необязательной: её видно один раз, любой шаг
 * закрывается Escape, и отказ запоминается. Навязчивый онбординг в продукте,
 * которым пользуются с чужого школьного компьютера, — это раздражение
 * на каждом заходе.
 */

import { t } from '../i18n.js';
import { mascot } from './mascot.js';

/**
 * Шаги. `target` — селектор реального элемента; если его нет на экране
 * (например, панель скрыта на телефоне), шаг показывается по центру,
 * а не ломает экскурсию.
 */
const ALL_STEPS = [
  { key: 'intro', target: null },
  // Витрина: новичок ещё не в продукте, показываем то, что есть на главной.
  { key: 'demo', target: '.demo-card' },
  { key: 'topics', target: '.marquee' },
  // Внутри продукта: разделы и ключевые экраны.
  { key: 'nav', target: '.side-nav' },
  { key: 'reco', target: '.reco, main .panel' },
  { key: 'sim', target: '.side-link[href="#/simulate"]' },
  { key: 'tutor', target: '.side-link[href="#/tutor"], .nav a[href="#/tutor"]' },
  { key: 'offline', target: '#netFlag' },
];

/**
 * Экскурсия подстраивается под экран, а не наоборот.
 *
 * Один жёсткий сценарий здесь не работает: у новичка на витрине нет ни
 * боковой панели, ни рекомендаций, а у вернувшегося ученика в кабинете нет
 * демо-карточки с главной. Раньше шаги были прибиты к кабинету — и новый
 * посетитель, ради которого онбординг и существует, не видел его вообще.
 * Поэтому оставляем только те шаги, чью цель видно прямо сейчас.
 */
let STEPS = [];

function pickSteps() {
  STEPS = ALL_STEPS.filter((s) => {
    if (!s.target) return true;
    const el = document.querySelector(s.target);
    return el && el.getBoundingClientRect().height > 0;
  });
  return STEPS.length > 1;
}

let i = 0;
let root = null;
let onDone = null;
let keyHandler = null;
let reposition = null;

/**
 * Экскурсия показывается один раз за визит, но заново при каждом заходе —
 * пока ученик не вошёл в аккаунт.
 *
 * Решение продуктовое, не техническое: почти весь трафик на защите и в первые
 * недели — это люди, открывающие сайт впервые, часто с чужого школьного
 * компьютера, где localStorage вычищается между уроками. Запоминать отказ
 * навсегда означало бы, что половина посетителей объяснения не увидит.
 * Ориентир на вход, а не на флаг в хранилище: вошёл — значит уже свой.
 *
 * Флаг живёт в памяти модуля, поэтому переходы между разделами экскурсию
 * не перезапускают, а перезагрузка страницы — считается новым визитом.
 */
let shownThisVisit = false;

export const tourSeen = () => shownThisVisit;

/** Запуск. Возвращает false, если экскурсию уже видели или уже показывают. */
export function startTour(finish) {
  if (root) return false;
  // Нечего показывать — не показываем пустую рамку.
  if (!pickSteps()) return false;
  i = 0;
  onDone = finish;
  build();
  show();
  return true;
}

function markDone() {
  shownThisVisit = true;
}

function build() {
  root = document.createElement('div');
  root.className = 'tour';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="tour-scrim" data-tour="skip"></div>
    <div class="tour-spot" aria-hidden="true"></div>
    <div class="tour-pop" role="document">
      <div class="tour-step"></div>
      <h3 class="tour-title"></h3>
      <p class="tour-body"></p>
      <div class="tour-dots" aria-hidden="true"></div>
      <div class="tour-btns">
        <button class="btn btn-ghost btn-sm" data-tour="skip"></button>
        <span class="tour-gap"></span>
        <button class="btn btn-sm" data-tour="prev"></button>
        <button class="btn btn-primary btn-sm" data-tour="next"></button>
      </div>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('tour-open');

  /* Экскурсию ведёт персонаж, а не безымянная карточка со стрелкой.
     Он перелетает к каждому следующему разделу — и ученик следит за ним,
     а не ищет глазами, что подсветилось. */
  mascot.toLayer('sm');

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-tour]')?.dataset.tour;
    if (!act) return;
    if (act === 'skip') return end();
    if (act === 'prev') { i = Math.max(0, i - 1); return show(); }
    if (act === 'next') { i += 1; return i >= STEPS.length ? end() : show(); }
  });

  keyHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    if (e.key === 'ArrowRight') { i += 1; i >= STEPS.length ? end() : show(); }
    if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); show(); }
  };
  document.addEventListener('keydown', keyHandler);

  // Поворот телефона и прокрутка не должны оставлять подсветку в пустоте.
  // Персонаж переносится к карточке без дуги: догонять уезжающую цель по
  // дуге — это не полёт, а дёрганье.
  reposition = () => {
    place();
    mascot.flyTo(root?.querySelector('.tour-pop'), { side: 'left', instant: true });
  };
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, { passive: true });
}

function show() {
  const step = STEPS[i];
  root.querySelector('.tour-step').textContent = `${i + 1} / ${STEPS.length}`;
  root.querySelector('.tour-title').textContent = t(`tour.${step.key}H`);
  root.querySelector('.tour-body').textContent = t(`tour.${step.key}B`);
  /* Именно в кнопке: атрибут data-tour="skip" висит ещё и на затемнении
     (клик мимо карточки закрывает экскурсию), и без уточнения селектора
     подпись уезжала в угол экрана поверх страницы. */
  root.querySelector('.tour-btns [data-tour="skip"]').textContent = t('tour.skip');
  root.querySelector('[data-tour="prev"]').textContent = t('tour.prev');
  root.querySelector('[data-tour="next"]').textContent =
    i === STEPS.length - 1 ? t('tour.finish') : t('tour.next');

  root.querySelector('[data-tour="prev"]').hidden = i === 0;
  root.querySelector('.tour-dots').innerHTML =
    STEPS.map((_, n) => `<i class="${n === i ? 'on' : ''}"></i>`).join('');

  place();

  // Персонаж подлетает к карточке шага и показывает крылом на подсвеченное.
  mascot.flyTo(root.querySelector('.tour-pop'), { side: 'left' });
  mascot.fire(i === STEPS.length - 1 ? 'proud' : 'point');
}

/**
 * Подсветка и позиция карточки.
 *
 * «Дыра» в затемнении сделана рамкой в 9999px, а не clip-path: так она
 * работает в старых мобильных браузерах, а Android-телефон в сельской
 * школе — вполне реальное устройство нашего пользователя.
 */
function place() {
  if (!root) return;
  const step = STEPS[i];
  const el = step.target ? document.querySelector(step.target) : null;
  const spot = root.querySelector('.tour-spot');
  const pop = root.querySelector('.tour-pop');

  if (!el) {
    spot.style.display = 'none';
    root.classList.add('tour-nospot');
    pop.className = 'tour-pop tour-pop-center';
    pop.style.cssText = '';
    return;
  }
  root.classList.remove('tour-nospot');

  const r = el.getBoundingClientRect();
  // Элемент прокручен за пределы экрана — ведём к нему, иначе подсвечивать нечего.
  if (r.bottom < 0 || r.top > window.innerHeight) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  const pad = 6;
  spot.style.display = '';
  spot.style.top = `${r.top - pad}px`;
  spot.style.left = `${r.left - pad}px`;
  spot.style.width = `${r.width + pad * 2}px`;
  spot.style.height = `${r.height + pad * 2}px`;

  pop.className = 'tour-pop';
  const below = r.bottom + 18;
  const fitsBelow = below + pop.offsetHeight < window.innerHeight - 12;
  const top = fitsBelow ? below : Math.max(12, r.top - pop.offsetHeight - 18);
  const left = Math.min(
    Math.max(12, r.left),
    Math.max(12, window.innerWidth - pop.offsetWidth - 12)
  );
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
}

function end() {
  markDone();
  // Персонаж возвращается на землю раньше, чем снимается затемнение: иначе
  // он на кадр остаётся висеть поверх уже обычного экрана.
  mascot.land();
  document.removeEventListener('keydown', keyHandler);
  window.removeEventListener('resize', reposition);
  window.removeEventListener('scroll', reposition);
  root?.remove();
  root = null;
  document.body.classList.remove('tour-open');
  onDone?.();
}

/** Повторный запуск из подвала — «показать экскурсию ещё раз». */
export function replayTour(finish) {
  shownThisVisit = false;
  return startTour(finish);
}
