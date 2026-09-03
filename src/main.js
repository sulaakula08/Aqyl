/**
 * AQYL — точка входа.
 * Хеш-роутер, оболочка приложения и регистрация обработчиков страниц.
 * Ноль зависимостей и ноль сборки: файлы отдаются как есть, поэтому
 * приложение разворачивается на GitHub Pages / Vercel / Netlify без CI.
 */

import { initDelegation, action, toast, html, raw } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { initMotion } from './ui/motion.js';
import { initFlourish } from './ui/flourish.js';
import { initMascot, mascot } from './ui/mascot.js';
import { feathers } from './ui/juice.js';
import { averageMastery } from './engine/recommender.js';
import { t, LANGS } from './i18n.js';
import { getProfile, getState, setLang, resetProgress, subscribe, update } from './state.js';
import { toggleSound } from './ui/sound.js';

import { renderHome } from './ui/home.js';
import { renderOnboarding, registerOnboardingActions } from './ui/onboarding.js';
import { renderDiagnostic, registerDiagnosticActions, resetDiagnostic } from './ui/diagnostic.js';
import { renderDashboard, greetOnDashboard, resetGreeting } from './ui/dashboard.js';
import { renderLearn, registerLearnActions, resetLearn } from './ui/learn.js';
import { renderGraph, registerGraphActions } from './ui/graph.js';
import { renderMethod } from './ui/method.js';
import { renderTutor, registerTutorActions, seedTutorQuestion, flushPending } from './ui/tutor.js';
import { renderTeacher, registerTeacherActions } from './ui/teacher.js';
import { renderPlan, registerPlanActions, reactToDeadline } from './ui/plan.js';
import { renderSimulate, registerSimulateActions, resetSimulate } from './ui/simulate.js';
import { renderAuthBlock, registerAuthActions, syncAfterLogin } from './ui/auth.js';
import { loadConfig, restoreSession, handleRedirect, getUser } from './cloud/supabase.js';
import { startTour, replayTour, tourSeen } from './ui/tour.js';

const main = document.getElementById('main');
const navEl = document.getElementById('nav');
const navEndEl = document.getElementById('navEnd');
const sidebarEl = document.getElementById('sidebar');
const scrimEl = document.getElementById('sidebarScrim');

/**
 * Навигация работает в двух режимах.
 *
 * На витрине (главная и методика) нужны три ссылки и один призыв к действию —
 * посетитель ещё не пользователь, длинное меню его только рассеивает.
 * Внутри продукта — рабочие разделы и индикатор уровня. Смешивать эти два
 * набора в одной панели было ошибкой: маркетинг и приложение требуют разной
 * плотности и разной иерархии.
 */
const NAV_SITE = [
  { path: '/method', key: 'app.methodNav' },
  { path: '/tutor', key: 'nav.tutor' },
  { path: '/graph', key: 'nav.graph' },
  { path: '/teacher', key: 'nav.teacher' },
];

const NAV_APP = [
  { path: '/dashboard', key: 'nav.dashboard', icon: 'home' },
  { path: '/graph', key: 'nav.graph', icon: 'graph' },
  { path: '/simulate', key: 'nav.simulate', icon: 'trend' },
  { path: '/plan', key: 'nav.plan', icon: 'calendar' },
  { path: '/tutor', key: 'nav.tutor', icon: 'chat' },
  { path: '/teacher', key: 'nav.teacher', icon: 'users' },
];

/**
 * Разделы боковой панели.
 *
 * Плоский список из шести пунктов читается как свалка: «Кабинет» и «Панель
 * учителя» — вещи разного порядка, и глазу негде остановиться. Две
 * подписанные группы дают ту же навигацию за одно движение глаза.
 */
const SIDEBAR_GROUPS = [
  { key: 'nav.grpLearn', items: ['/dashboard', '/graph', '/simulate', '/plan', '/tutor'] },
  { key: 'nav.grpClass', items: ['/teacher'] },
];

const SITE_ROUTES = new Set(['/', '/method']);

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  return { path, params: new URLSearchParams(query || '') };
}

function view() {
  const { path, params } = parseHash();
  const seg = path.split('/').filter(Boolean);

  switch (seg[0]) {
    case undefined: return renderHome();
    case 'onboarding': return renderOnboarding();
    case 'diagnostic': return renderDiagnostic();
    case 'dashboard': return renderDashboard();
    case 'learn': return renderLearn(seg[1]);
    case 'graph': return renderGraph();
    case 'method': return renderMethod();
    case 'plan': return renderPlan();
    case 'simulate': return renderSimulate();
    case 'teacher': return renderTeacher();
    case 'tutor':
      if (params.get('q')) seedTutorQuestion(params.get('q'));
      return renderTutor();
    default: return notFound();
  }
}

function notFound() {
  return html`
    <div class="page wrap center" style="max-width:520px">
      <h1 style="font-size:2rem">${t('app.notFound')}</h1>
      <p style="margin:12px 0 22px">${t('app.notFoundSub')}</p>
      <a class="btn btn-primary" href="#/">${t('app.toHome')}</a>
    </div>`;
}

let scrollTopOnNext = true;
let lastSection = null;   // какой раздел показывали в прошлый раз

function render() {
  main.innerHTML = view();
  renderShell();
  if (scrollTopOnNext) window.scrollTo({ top: 0, behavior: 'instant' });
  scrollTopOnNext = false;
  // Разметка движения — после вставки разметки, до того как браузер отрисует
  // кадр: иначе полосы успели бы мелькнуть на финальном значении.
  initMotion(main);
  initFlourish(main);
  // Талисман переезжает в гнездо нового экрана. Если гнезда нет — экран
  // обходится без него (панель учителя), и это не ошибка, а решение.
  initMascot(main);
  /* Рост персонажа сверяется с той же средней освоенностью, которой кабинет
     рисует кольцо. Проверка на каждой отрисовке ничего не стоит: линька
     играется только при переходе на новую ступень, всё остальное время это
     сравнение двух чисел. */
  mascot.grow(averageMastery(getProfile()));

  const { path, params } = parseHash();
  if (path.startsWith('/tutor') && params.get('q')) flushPending(rerender);
  /* Экраны без собственных обработчиков всё же имеют что сказать талисману:
     кабинет — встречу и прерванную серию, план — приближающийся экзамен.
     Обе реакции срабатывают один раз за визит, поэтому вызов на каждой
     перерисовке безопасен. */
  if (path === '/dashboard') greetOnDashboard();
  else if (path === '/plan') reactToDeadline();

  /* Перья при входе в занятие.
     Только сюда, и намеренно: если ронять их на каждом переходе, к третьему
     разделу это станет фоном. Здесь же они отмечают ровно один момент —
     ученик сел заниматься, — и потому продолжают что-то значить. */
  const section = path.split('/')[1] || '';
  if (section !== lastSection) {
    if ((section === 'learn' || section === 'diagnostic') && lastSection !== null) feathers(null, 4);
    lastSection = section;
  }
  applyStaticI18n();
  document.documentElement.lang = getState().settings.lang;
}

/** Перерисовка без прыжка к началу страницы — для интерактива внутри экрана. */
function rerender() { render(); }

function navigate(path) {
  scrollTopOnNext = true;
  location.hash = path;
}

const langButtons = (lang) => LANGS
  .map((l) => `<button data-act="lang" data-id="${l.id}" class="${lang === l.id ? 'on' : ''}"
                       aria-pressed="${lang === l.id}">${l.label}</button>`)
  .join('');

/**
 * Перевод статической разметки index.html.
 *
 * Шапка, подвал и служебные подписи живут в HTML, а не в шаблонах экранов,
 * поэтому переводятся здесь по data-атрибутам. В самом HTML остаётся русский
 * текст: так страница читается и до загрузки модулей, и в поиске.
 */
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.dataset.i18nTitle)); });
  document.querySelectorAll('[data-i18n-content]').forEach((el) => { el.setAttribute('content', t(el.dataset.i18nContent)); });
}

/**
 * Оболочка: шапка на витрине, боковая панель внутри продукта.
 *
 * Разделение уже было в навигации (NAV_SITE против NAV_APP), но обе жили
 * в одной горизонтальной полосе — и по мере роста продукта полоса перестала
 * держать нагрузку: шесть равнозначных ссылок в ряд не дают иерархии, а
 * добавить седьмую было уже некуда. Внутри приложения навигация переезжает
 * влево, где у неё есть вертикаль, место под группы и под статус ученика.
 */
function renderShell() {
  const { path } = parseHash();
  const isSite = SITE_ROUTES.has(path);

  document.body.classList.toggle('app-shell', !isSite);
  sidebarEl.hidden = isSite;

  if (isSite) renderSiteNav(path);
  else { navEl.innerHTML = ''; renderSidebar(path); }

  renderTopbarEnd(isSite);
  document.getElementById('langSwitch').innerHTML = langButtons(getState().settings.lang);
}

function ctaFor(isSite) {
  const p = getProfile();
  const started = p.diagnosticDone || p.attempts > 0;
  return isSite
    ? { href: '#' + (started ? '/dashboard' : '/onboarding'), label: started ? t('cta.continue') : t('cta.start') }
    : { href: '#/onboarding', label: t('cta.diagnostic') };
}

function renderSiteNav(path) {
  const lang = getState().settings.lang;
  const cta = ctaFor(true);

  const links = NAV_SITE
    .map((n, i) => {
      const current = path === n.path ? ' aria-current="page"' : '';
      return `<a href="#${n.path}" class="${path === n.path ? 'active' : ''}"${current} style="--i:${i}">${t(n.key)}</a>`;
    })
    .join('');

  /* Ниже ссылок — блок, который виден только в выдвижном меню. На узком
     экране язык и главная кнопка не помещаются в шапку рядом с логотипом,
     поэтому они переезжают сюда, а не сжимаются до нечитаемых огрызков. */
  navEl.innerHTML = `${links}
    <div class="nav-foot">
      <div class="lang-switch" role="group" aria-label="${t('app.langLabel')}">${langButtons(lang)}</div>
      <a class="btn btn-primary btn-block" href="${cta.href}">${cta.label}</a>
    </div>`;
}

const NAV_BY_PATH = Object.fromEntries(NAV_APP.map((n) => [n.path, n]));

function renderSidebar(path) {
  const p = getProfile();
  const started = p.diagnosticDone || p.attempts > 0;

  const groups = SIDEBAR_GROUPS.map((g) => `
    <div class="side-group">
      <div class="side-label">${t(g.key)}</div>
      ${g.items.map((pth) => {
        const n = NAV_BY_PATH[pth];
        if (!n) return '';
        const on = path === n.path;
        return `<a href="#${n.path}" class="side-link${on ? ' active' : ''}"${on ? ' aria-current="page"' : ''}>
                  <span class="side-ic">${icon(n.icon, 17)}</span>${t(n.key)}
                </a>`;
      }).join('')}
    </div>`).join('');

  /* Статус ученика внизу панели, а не в шапке: это фон, а не действие.
     Пока диагностика не пройдена, вместо цифр стоит призыв её пройти —
     нули в этом месте читались бы как «ты ничего не добился». */
  const status = started
    ? `<a class="side-status" href="#/dashboard">
         <div><b>${p.theta >= 0 ? '+' : ''}${p.theta.toFixed(2)}</b><span>${t('dash.level')}</span></div>
         <div><b>${p.xp}</b><span>${t('dash.xp')}</span></div>
         <div><b>${p.streakDays}</b><span>${t('dash.streak')}</span></div>
       </a>`
    : `<a class="btn btn-primary btn-block btn-sm" href="#/onboarding">${t('cta.diagnostic')}</a>`;

  /* Переключатель языка обязан быть и здесь. На узком экране он спрятан из
     шапки, а раньше жил в выдвижном меню витрины — которого в режиме
     приложения больше нет. Без этой строки казахоязычный ученик с телефона
     не смог бы сменить язык вообще. */
  /* Звук и талисман выключаются здесь же, рядом с языком.
     Оба — про то, как ученику удобно заниматься, а не про содержание, и
     обе настройки обязаны быть на виду: звук в классе бывает недопустим,
     а живой персонаж кому-то мешает сосредоточиться. Прятать это в
     отдельный экран настроек значило бы, что им никто не воспользуется. */
  const s = getState().settings;
  const toggles = `
    <div class="lang-switch side-toggles" role="group" aria-label="${t('app.prefsLabel')}">
      <button data-act="toggle-sound" class="${s.sound ? 'on' : ''}" aria-pressed="${Boolean(s.sound)}"
              title="${t('app.soundToggle')}" aria-label="${t('app.soundToggle')}">${icon('sound', 14)}</button>
      <button data-act="toggle-mascot" class="${s.mascot !== 'off' ? 'on' : ''}" aria-pressed="${s.mascot !== 'off'}"
              title="${t('app.mascotToggle')}" aria-label="${t('app.mascotToggle')}">${icon('bird', 14)}</button>
    </div>`;

  sidebarEl.innerHTML = `
    <nav class="side-nav" aria-label="${t('app.navMain')}">${groups}</nav>
    <div class="side-foot">
      <div class="lang-switch side-lang" role="group" aria-label="${t('app.langLabel')}">
        ${langButtons(getState().settings.lang)}
      </div>
      ${toggles}
      ${renderAuthBlock()}
      ${status}
    </div>`;
}

function renderTopbarEnd(isSite) {
  const p = getProfile();
  const started = p.diagnosticDone || p.attempts > 0;
  const cta = ctaFor(isSite);

  navEndEl.innerHTML = !isSite && started
    ? `<a class="level-chip" href="#/dashboard" title="${t('dash.level')} · ${t('dash.xp')}">
         <i>θ</i><b>${p.theta >= 0 ? '+' : ''}${p.theta.toFixed(2)}</b>
       </a>`
    : `<a class="btn btn-sm btn-primary nav-cta" href="${cta.href}">${cta.label}</a>`;
}

/* ─── Глобальные действия ─────────────────────────────────────────────── */

action('lang', ({ id }) => {
  setLang(id);
  toast(t('app.langToast'));
  render();
});

action('tour', () => replayTour(rerender));

action('toggle-sound', () => {
  toast(t(toggleSound() ? 'app.soundOn' : 'app.soundOff'));
  renderShell();
});

/* Талисман переключается целиком, а не по режимам: «спокойный» режим
   включается сам — по prefers-reduced-motion и на слабом устройстве, — и
   выносить его в кнопку значило бы просить ученика разбираться в том, о чём
   система и так знает. */
action('toggle-mascot', () => {
  update((s) => { s.settings.mascot = s.settings.mascot === 'off' ? 'full' : 'off'; });
  toast(t(getState().settings.mascot === 'off' ? 'app.mascotOff' : 'app.mascotOn'));
  render();
});

action('reset', () => {
  if (!confirm(t('app.resetConfirm'))) return;
  resetDiagnostic();
  resetLearn();
  resetSimulate();
  resetGreeting();
  resetProgress();
  toast(t('app.resetDone'));
  navigate('/');
  render();
});

registerOnboardingActions(navigate);
registerDiagnosticActions(rerender, navigate);
registerLearnActions(rerender);
registerGraphActions(rerender);
registerTutorActions(rerender);
registerTeacherActions(rerender);
registerPlanActions(rerender);
registerSimulateActions(rerender);
registerAuthActions(rerender);

/* ─── Оболочка ────────────────────────────────────────────────────────── */

initDelegation(document.body);

document.getElementById('themeBtn').addEventListener('click', () => {
  const el = document.documentElement;
  const next = el.dataset.theme === 'light' ? 'dark' : 'light';
  el.dataset.theme = next;
  localStorage.setItem('aqyl.theme', next);
});
// По умолчанию — светлая тема: продукт для школы, его смотрят днём и с проектора.
document.documentElement.dataset.theme = localStorage.getItem('aqyl.theme') || 'light';

/**
 * Выдвижное меню.
 *
 * Раньше состояние жило в двух местах — класс на списке и aria-expanded на
 * кнопке — и расходилось: после перехода по ссылке меню закрывалось, а кнопка
 * продолжала сообщать скринридеру «раскрыто». Теперь состояние одно, и его
 * меняет только setNav(): класс, атрибут и блокировка прокрутки фона всегда
 * согласованы.
 */
const burger = document.getElementById('burger');

/* Бургер открывает то меню, которое сейчас существует: на витрине это
   выпадающая панель под шапкой, внутри продукта — боковая. Иначе на
   телефоне разделы приложения оказались бы недостижимы вовсе. */
const drawer = () => (document.body.classList.contains('app-shell') ? sidebarEl : navEl);

function setNav(open) {
  const el = drawer();
  navEl.classList.remove('open');
  sidebarEl.classList.remove('open');
  el.classList.toggle('open', open);
  scrimEl.hidden = !open;
  burger.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('nav-locked', open);
}

burger.addEventListener('click', (e) => {
  e.stopPropagation();
  setNav(!drawer().classList.contains('open'));
});

// Клик по ссылке закрывает меню; переключатель языка внутри — нет,
// иначе смена языка выбрасывала бы из меню на полпути.
const closeOnLink = (e) => { if (e.target.closest('a')) setNav(false); };
navEl.addEventListener('click', closeOnLink);
sidebarEl.addEventListener('click', closeOnLink);
scrimEl.addEventListener('click', () => setNav(false));

// Клик мимо меню и Escape — привычные способы его закрыть.
document.addEventListener('click', (e) => {
  if (drawer().classList.contains('open') && !e.target.closest('.nav, .sidebar, .burger')) setNav(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawer().classList.contains('open')) { setNav(false); burger.focus(); }
});
// Возврат к десктопной ширине не должен оставлять body заблокированным.
window.matchMedia('(min-width: 861px)').addEventListener('change', (m) => { if (m.matches) setNav(false); });

// Тень под шапкой появляется только когда под ней действительно есть контент.
const onScroll = () => document.querySelector('.topbar').classList.toggle('scrolled', window.scrollY > 4);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Индикатор сети: демонстрирует, что офлайн ничего не ломает.
const netFlag = document.getElementById('netFlag');
function updateNet() {
  const on = navigator.onLine;
  netFlag.innerHTML = `<i></i> ${on ? t('app.online') : t('app.offline')}`;
  netFlag.classList.toggle('off', !on);
}
/* Пропажа сети — момент, ради которого построена половина архитектуры,
   и ученик должен увидеть, что ничего не сломалось. Персонаж кивает и
   говорит об этом одной строкой; возвращение сети молчит — о хорошем
   сообщать незачем, это состояние по умолчанию. */
window.addEventListener('online', updateNet);
window.addEventListener('offline', () => {
  updateNet();
  mascot.fire('nod');
  mascot.say(t('mascot.offline'));
});
updateNet();

window.addEventListener('hashchange', () => { scrollTopOnNext = true; setNav(false); render(); });
subscribe(() => renderShell());

// Service worker: после первого визита приложение открывается без сети.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {/* офлайн-режим просто не включится */});
  });
}

/* Сессия читается из localStorage синхронно, до первого кадра: от неё
   зависит, показывать ли экскурсию, и асинхронная проверка дала бы вспышку
   онбординга у уже вошедшего пользователя. */
restoreSession();

render();

/**
 * Экскурсия — после первой отрисовки и только в кабинете.
 *
 * Показывать её на витрине незачем: там и так всё объяснено текстом. А до
 * диагностики подсвечивать «вот твои рекомендации» просто не на чем —
 * рекомендаций ещё нет. Поэтому ждём момента, когда интерфейс наполнен.
 */
/**
 * Выполнить после отрисовки кадра — но не в ущерб фоновой вкладке.
 *
 * Одного requestAnimationFrame мало: в скрытой вкладке кадры не рисуются
 * вовсе, и колбэк не вызывается никогда. Ученик, открывший ссылку в фоновой
 * вкладке, не увидел бы экскурсию и после переключения на неё. Поэтому rAF
 * идёт в паре с таймером, и срабатывает тот, кто успел первым.
 */
function afterPaint(fn) {
  let done = false;
  const once = () => { if (!done) { done = true; fn(); } };
  requestAnimationFrame(() => requestAnimationFrame(once));
  setTimeout(once, 120);
}

const TOUR_ROUTES = new Set(['/', '/dashboard']);

function maybeTour() {
  if (tourSeen()) return;
  // Вошедшему ученику объяснять интерфейс не нужно — он тут не впервые.
  if (getUser()) return;
  const { path } = parseHash();
  /* И на витрине тоже. Раньше здесь стоял только '/dashboard' плюс проверка
     пройденной диагностики — то есть онбординг для новичка не запускался
     ровно для новичка: до диагностики он в кабинет не попадает. */
  if (!TOUR_ROUTES.has(path)) return;
  // Даём кадру отрисоваться: подсветка считает координаты живых элементов.
  afterPaint(() => startTour(rerender));
}
maybeTour();
window.addEventListener('hashchange', maybeTour);

/**
 * Облако подключается после первого кадра, а не до него.
 *
 * Приложение обязано открываться и работать без сети — значит ждать ответа
 * /api/config перед первой отрисовкой нельзя: на плохом канале это дало бы
 * секунды белого экрана ради кнопки входа, которая ученику не нужна, чтобы
 * начать заниматься. Поэтому сначала рисуем, потом дорисовываем вход.
 */
(async () => {
  await loadConfig();
  const fresh = await handleRedirect();
  renderShell();
  if (fresh) { toast(t('auth.welcome')); await syncAfterLogin(rerender); }
})();
