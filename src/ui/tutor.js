import { html, raw, action, md, toast } from './dom.js';
import { icon } from './icons.js';
import { mascot } from './mascot.js';
import { t, tf, loc, lang } from '../i18n.js';
import { getProfile, getSettings, update } from '../state.js';
import { answerLocally, answerWithServer } from '../engine/tutor.js';
import { getActiveItem } from './learn.js';
import { TOPIC_BY_ID } from '../data/curriculum.js';

let log = [];
// Язык, на котором собрано приветствие: иначе оно оставалось бы на том языке,
// который был активен при первом открытии экрана.
let greetingLang = null;
let busy = false;

// Ключи, а не готовые строки: подсказки должны меняться вместе с языком.
const SUGGESTION_KEYS = ['tutor.q1', 'tutor.q2', 'tutor.q3', 'tutor.q4'];

export function seedTutorQuestion(q) {
  if (q && !log.some((m) => m.text === q)) pendingQuestion = q;
}
let pendingQuestion = null;

export function renderTutor() {
  const s = getSettings();

  if (!log.length || (log.length === 1 && greetingLang && greetingLang !== lang())) {
    log = [{
      role: 'bot',
      text: t('tutor.greeting'),
      refs: [],
    }];
    greetingLang = lang();
  }

  return html`
  <div class="page wrap" style="max-width:860px">
    <div class="page-head">
      <div>
        <span class="label label-accent">${t('tutor.title')}</span>
        <h1 style="font-size:2rem;margin-top:14px">${t('tutor.h1')}</h1>
        <p style="margin-top:6px">${t('tutor.sub')}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="pill ${s.cloudAI ? 'pill-strong' : 'pill-mastered'}">
          ${raw(icon(s.cloudAI ? 'cloud' : 'bolt'))} ${s.cloudAI ? t('tutor.modeAuto') : t('tutor.modeOffline')}
        </span>
        <button class="btn btn-ghost btn-sm" data-act="toggle-ai">${t('tutor.toggle')}</button>
        <!-- Персонаж здесь не украшение: пока идёт запрос, он и есть индикатор
             ожидания, а когда ответ пришёл — он его «произносит». -->
        <div class="mascot-slot mascot-slot-inline" data-mascot="tutor" data-size="md"></div>
      </div>
    </div>

    <div class="panel chat">
      <div class="chat-log" id="chatLog">
        ${raw(log.map((m, i) => renderMsg(m, i)).join(''))}
        ${raw(busy ? '<div class="msg bot"><span class="typing"><i></i><i></i><i></i></span></div>' : '')}
      </div>

      <form class="chat-input" data-act="tutor-send">
        <input class="input" name="q" id="tutorInput" placeholder="${t('tutor.placeholder')}" autocomplete="off" ${busy ? 'disabled' : ''}>
        <button class="btn btn-primary" type="submit" aria-label="${t('tutor.send')}" ${busy ? 'disabled' : ''}>${raw(icon('arrowRight', 17))}</button>
      </form>

      <div class="chat-chips">
        ${raw(SUGGESTION_KEYS.map((k) => t(k)).map((q) => `<button class="choice" data-act="tutor-suggest" data-q="${q.replace(/"/g, '&quot;')}">${q}</button>`).join(''))}
      </div>
    </div>

    <div class="panel" style="margin-top:18px">
      <h3 style="margin-bottom:8px">${t('tutor.howH')}</h3>
      <p style="font-size:.9rem">
        <strong style="color:var(--text)">${t('tutor.howOffT')}</strong> ${t('tutor.howOffB')}
      </p>
      <p style="font-size:.9rem;margin-top:10px">
        <strong style="color:var(--text)">${t('tutor.howCloudT')}</strong> ${t('tutor.howCloudB')}
      </p>
      <p style="font-size:.85rem;margin-top:14px;color:var(--text-faint);border-top:1px solid var(--rule);padding-top:12px">
        ${t('tutor.keyNote')}
      </p>
    </div>
  </div>`;
}

function renderMsg(m, index = 0) {
  const refs = (m.refs || []).map((id) => TOPIC_BY_ID[id]).filter(Boolean);
  /* Кнопка «прослушать» — не дубликат озвучки из экрана учёбы, а её место
     здесь: разбор репетитора длиннее условия задачи, и именно его тяжелее
     всего читать ученику с дислексией. Заодно это единственный путь, на
     котором персонаж говорит вслух: сам он ничего не зачитывает. */
  const listen = m.role === 'bot'
    ? `<button class="icon-btn msg-say" data-act="tutor-say" data-i="${index}"
               title="${t('common.listen')}" aria-label="${t('common.listen')}">${icon('sound', 15)}</button>`
    : '';
  return `
    <div class="msg ${m.role} ${m.socratic ? 'socratic' : ''}">
      ${listen}
      ${md(m.text).value}
      ${refs.length ? `<div class="chat-chips" style="margin-top:10px">
        ${refs.map((tp) => `<a class="pill" href="#/learn/${tp.id}">${loc(tp)} ${icon('arrowRight')}</a>`).join('')}
      </div>` : ''}
      ${(m.chips || []).length ? `<div class="chat-chips">
        ${m.chips.map(chipHtml).join('')}
      </div>` : ''}
    </div>`;
}

const CHIP_HREF = { graph: '#/graph', plan: '#/plan' };

function chipHtml(c) {
  if (c.action.startsWith('learn:')) {
    return `<a class="btn btn-sm btn-accent" href="#/learn/${c.action.slice(6)}">${c.label}</a>`;
  }
  const href = CHIP_HREF[c.action];
  if (href) return `<a class="btn btn-sm btn-accent" href="${href}">${c.label}</a>`;
  // hint / easier осмысленны только внутри открытого задания.
  const item = getActiveItem();
  if (item && item.item) return `<a class="btn btn-sm" href="#/learn/${item.item.topic}">${c.label}</a>`;
  return `<span class="pill">${c.label}</span>`;
}

async function ask(text, rerender) {
  /* Защита от повторного входа.
     Здесь была рекурсия, вешавшая вкладку: ask() перерисовывает экран до
     запроса, а перерисовка на маршруте `#/tutor?q=…` заново заводила тот же
     вопрос и снова вызывала ask(). Каждый виток добавлял ещё один запрос к
     модели, и вкладка уходила в себя. Причину чиним ниже (адрес чистится в
     flushPending), но вход в ask() обязан быть защищён сам по себе: это
     функция, которая уходит в сеть, и она не может зависеть от того, кто и
     сколько раз её позвал. */
  if (busy) return;

  log.push({ role: 'me', text });
  busy = true;
  rerender();
  scrollDown();
  // Пока идёт запрос, ожидание показывает персонаж, а не спиннер: ученик
  // видит, что его вопрос обдумывают, а не что интерфейс подвис.
  mascot.fire('think');

  const p = getProfile();
  const s = getSettings();
  // Контекст: если ученик оставил открытым задание, репетитор ведёт по нему.
  const ctx = getActiveItem() || {};
  // История без только что добавленной реплики — её эндпоинт получает отдельно.
  const history = log.slice(0, -1).filter((m) => m.role === 'me' || m.role === 'bot');
  let reply;
  try {
    if (s.cloudAI && navigator.onLine) {
      reply = await answerWithServer(text, p, ctx, lang(), history);
    } else {
      // Небольшая пауза — чтобы ответ читался как диалог, а не как мгновенный дамп.
      await new Promise((r) => setTimeout(r, 320));
      reply = answerLocally(text, p, ctx, lang());
    }
  } catch (e) {
    /* Падение облака — штатный сценарий, а не ошибка: ради него и построен
       разбор на устройстве. Ученику показываем разбор и одну строку о том,
       почему он локальный, — молчаливая подмена сбивала бы с толку. */
    reply = answerLocally(text, p, ctx, lang());
    reply.text = t('tutor.cloudFail') + '\n\n' + reply.text;
  }
  log.push({ role: 'bot', ...reply });
  busy = false;
  rerender();
  scrollDown();

  /* Ответ пришёл — персонаж «произносит» его беззвучно: клюв работает,
     ученик читает. Вслух только по кнопке: класс, двадцать устройств. */
  mascot.fire('idle');
  typeOut(document.querySelector('.chat-log .msg.bot:last-of-type'), reply.text);
}

/**
 * Ответ открывается слово за словом — ровно в том темпе, в котором персонаж
 * его «произносит».
 *
 * Разница с обычным «эффектом печати» в том, что темп здесь не выдуман: слова
 * приходят из того же источника, что и движение клюва (`mascot.say` →
 * `speech.js`), а если ученик включит озвучку — из событий `boundary` самого
 * синтезатора речи. Тогда слово появляется на экране ровно в тот момент,
 * когда голос его произносит. Стена текста, возникающая мгновенно, читается
 * как выгрузка из базы; текст, который кто-то говорит, читается как ответ.
 *
 * Скрытые слова заранее занимают своё место (opacity, а не display), поэтому
 * абзац не прыгает и не пересобирается по мере появления.
 */
function typeOut(msgEl, text) {
  if (!msgEl || mascot.calm()) { mascot.say(text, { aloud: false, bubble: false }); return; }

  const words = [];
  const walker = document.createTreeWalker(msgEl, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    // Кнопки-действия под ответом — не речь: их прятать нельзя.
    if (!n.parentElement.closest('.chat-chips')) nodes.push(n);
  }

  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
      const span = document.createElement('span');
      span.className = 'fx-word';
      span.textContent = part;
      frag.appendChild(span);
      words.push(span);
    });
    node.parentNode.replaceChild(frag, node);
  });

  if (!words.length) return;

  const showAll = () => words.forEach((w) => w.classList.add('on'));

  mascot.say(text, {
    aloud: false,
    bubble: false,
    onWord: (i) => {
      // Открываем всё до текущего слова включительно: если событие речи
      // где-то пропущено, текст не остаётся с дырой посередине.
      for (let k = 0; k <= i && k < words.length; k++) words[k].classList.add('on');
    },
    onEnd: showAll,
  });

  /* Страховка. Персонаж мог замолчать раньше (ученик ушёл с экрана, речь
     прервана) — текст ответа при этом обязан быть виден целиком. Скрытый
     ответ репетитора хуже, чем ответ без анимации. */
  setTimeout(showAll, Math.min(12_000, 900 + text.length * 26));
}

function scrollDown() {
  requestAnimationFrame(() => {
    const el = document.getElementById('chatLog');
    if (el) el.scrollTop = el.scrollHeight;
  });
}

export function registerTutorActions(rerender) {
  action('tutor-send', (_d, form) => {
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    ask(text, rerender);
  });

  action('tutor-suggest', ({ q }) => { if (!busy) ask(q, rerender); });

  action('tutor-say', ({ i }) => {
    const m = log[Number(i)];
    if (!m) return;
    if (!getSettings().tts) return toast(t('learn.ttsOff'));
    mascot.say(m.text, { aloud: true, bubble: false });
  });

  action('toggle-ai', () => {
    update((st) => { st.settings.cloudAI = !st.settings.cloudAI; });
    toast(t(getSettings().cloudAI ? 'tutor.cloudOn' : 'tutor.offlineOn'));
    rerender();
  });
}

/**
 * Вызывается роутером: вопрос, переданный из другой страницы через ?q=.
 *
 * Адрес чистится ДО запроса, и это главное здесь.
 *
 * Вопрос заводился из параметра `?q=` при каждой отрисовке экрана, а сама
 * отрисовка происходит внутри ask(). Получалась воронка: ask() → перерисовка
 * → снова тот же вопрос из адреса → ask() → … Вкладка зависала, а к модели
 * уходил запрос на каждом витке — на слабом ноутбуке это выглядело как
 * «репетитор грузится вечно», хотя на самом деле он отвечал на десяток
 * копий одного вопроса.
 *
 * replaceState, а не переход: смена адреса не должна перезапускать роутер.
 */
export function flushPending(rerender) {
  if (!pendingQuestion || busy) return;
  const q = pendingQuestion;
  pendingQuestion = null;
  if (location.hash.includes('?q=')) history.replaceState(null, '', '#/tutor');
  ask(tf('tutor.explainTopic', { q }), rerender);
}
