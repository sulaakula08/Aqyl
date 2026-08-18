/**
 * AQYL — точка входа.
 * Хеш-роутер, оболочка приложения и регистрация обработчиков страниц.
 * Ноль зависимостей и ноль сборки: файлы отдаются как есть, поэтому
 * приложение разворачивается на GitHub Pages / Vercel / Netlify без CI.
 */

import { initDelegation, action, toast, html, raw } from './ui/dom.js';
import { initMotion } from './ui/motion.js';
import { t, LANGS } from './i18n.js';
import { getProfile, getState, setLang, resetProgress, subscribe, update } from './state.js';

import { renderHome } from './ui/home.js';
import { renderOnboarding, registerOnboardingActions } from './ui/onboarding.js';
import { renderDiagnostic, registerDiagnosticActions, resetDiagnostic } from './ui/diagnostic.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderLearn, registerLearnActions, resetLearn } from './ui/learn.js';
import { renderGraph, registerGraphActions } from './ui/graph.js';
import { renderMethod } from './ui/method.js';
import { renderTutor, registerTutorActions, seedTutorQuestion, flushPending } from './ui/tutor.js';
import { renderTeacher, registerTeacherActions } from './ui/teacher.js';
import { renderPlan, registerPlanActions } from './ui/plan.js';

const main = document.getElementById('main');
const navEl = document.getElementById('nav');
const navEndEl = document.getElementById('navEnd');

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
  { path: '/method', label: { ru: 'Как устроен ИИ', kk: 'ИИ қалай жұмыс істейді', en: 'How the AI works' } },
  { path: '/graph', key: 'nav.graph' },
  { path: '/teacher', key: 'nav.teacher' },
];

const NAV_APP = [
  { path: '/dashboard', key: 'nav.dashboard' },
  { path: '/graph', key: 'nav.graph' },
  { path: '/plan', key: 'nav.plan' },
  { path: '/tutor', key: 'nav.tutor' },
  { path: '/teacher', key: 'nav.teacher' },
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
      <h1 style="font-size:2rem">Страница не найдена</h1>
      <p style="margin:12px 0 22px">Возможно, ссылка устарела.</p>
      <a class="btn btn-primary" href="#/">На главную</a>
    </div>`;
}

let scrollTopOnNext = true;

function render() {
  main.innerHTML = view();
  renderNav();
  if (scrollTopOnNext) window.scrollTo({ top: 0, behavior: 'instant' });
  scrollTopOnNext = false;
  // Разметка движения — после вставки разметки, до того как браузер отрисует
  // кадр: иначе полосы успели бы мелькнуть на финальном значении.
  initMotion(main);

  const { path, params } = parseHash();
  if (path.startsWith('/tutor') && params.get('q')) flushPending(rerender);
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

function renderNav() {
  const { path } = parseHash();
  const isSite = SITE_ROUTES.has(path);
  const items = isSite ? NAV_SITE : NAV_APP;
  const lang = getState().settings.lang;
  const p = getProfile();
  const started = p.diagnosticDone || p.attempts > 0;

  const cta = isSite
    ? { href: '#' + (started ? '/dashboard' : '/onboarding'), label: started ? t('cta.continue') : t('cta.start') }
    : { href: '#/onboarding', label: t('cta.diagnostic') };

  const links = items
    .map((n, i) => {
      const label = n.key ? t(n.key) : (n.label[lang] || n.label.ru);
      const current = path === n.path ? ' aria-current="page"' : '';
      return `<a href="#${n.path}" class="${path === n.path ? 'active' : ''}"${current} style="--i:${i}">${label}</a>`;
    })
    .join('');

  /* Ниже ссылок — блок, который виден только в выдвижном меню. На узком
     экране язык и главная кнопка не помещаются в шапку рядом с логотипом,
     поэтому они переезжают сюда, а не сжимаются до нечитаемых огрызков. */
  navEl.innerHTML = `${links}
    <div class="nav-foot">
      <div class="lang-switch" role="group" aria-label="Язык интерфейса">${langButtons(lang)}</div>
      <a class="btn btn-primary btn-block" href="${cta.href}">${cta.label}</a>
    </div>`;

  navEndEl.innerHTML = !isSite && started
    ? `<a class="level-chip" href="#/dashboard" title="${t('dash.level')} · ${t('dash.xp')}">
         <i>θ</i><b>${p.theta >= 0 ? '+' : ''}${p.theta.toFixed(2)}</b>
       </a>`
    : `<a class="btn btn-sm btn-primary nav-cta" href="${cta.href}">${cta.label}</a>`;

  document.getElementById('langSwitch').innerHTML = langButtons(lang);
}

/* ─── Глобальные действия ─────────────────────────────────────────────── */

action('lang', ({ id }) => {
  setLang(id);
  toast(id === 'kk' ? 'Тіл: қазақша' : id === 'en' ? 'Language: English' : 'Язык: русский');
  render();
});

action('reset', () => {
  if (!confirm('Сбросить весь прогресс и демо-данные класса?')) return;
  resetDiagnostic();
  resetLearn();
  resetProgress();
  toast('Прогресс сброшен');
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

function setNav(open) {
  navEl.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('nav-locked', open);
}

burger.addEventListener('click', (e) => {
  e.stopPropagation();
  setNav(!navEl.classList.contains('open'));
});

// Клик по ссылке закрывает меню; переключатель языка внутри — нет,
// иначе смена языка выбрасывала бы из меню на полпути.
navEl.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });

// Клик мимо меню и Escape — привычные способы его закрыть.
document.addEventListener('click', (e) => {
  if (navEl.classList.contains('open') && !e.target.closest('.nav, .burger')) setNav(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navEl.classList.contains('open')) { setNav(false); burger.focus(); }
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
  netFlag.innerHTML = on ? '<i></i> online' : '<i></i> offline — приложение работает';
  netFlag.classList.toggle('off', !on);
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
updateNet();

window.addEventListener('hashchange', () => { scrollTopOnNext = true; setNav(false); render(); });
subscribe(() => renderNav());

// Service worker: после первого визита приложение открывается без сети.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {/* офлайн-режим просто не включится */});
  });
}

render();
