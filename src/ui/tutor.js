import { html, raw, action, md, toast } from './dom.js';
import { icon } from './icons.js';
import { t, tf, loc, lang } from '../i18n.js';
import { getProfile, getSettings, update } from '../state.js';
import { answerLocally, answerWithClaude } from '../engine/tutor.js';
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
          ${raw(icon(s.cloudAI ? 'cloud' : 'bolt'))} ${s.cloudAI ? t('tutor.cloud') : t('tutor.offline')}
        </span>
        <button class="btn btn-ghost btn-sm" data-act="toggle-ai">${t('tutor.toggle')}</button>
      </div>
    </div>

    <div class="panel chat">
      <div class="chat-log" id="chatLog">
        ${raw(log.map(renderMsg).join(''))}
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
      <div class="field" style="margin-top:16px">
        <label for="apiKey">${t('tutor.keyLabel')}</label>
        <input class="input" id="apiKey" type="password" placeholder="sk-ant-…" value="${getSettings().apiKey}" data-act="noop">
        <button class="btn btn-sm" data-act="save-key" style="justify-self:start">${t('tutor.saveKey')}</button>
      </div>
    </div>
  </div>`;
}

function renderMsg(m) {
  const refs = (m.refs || []).map((id) => TOPIC_BY_ID[id]).filter(Boolean);
  return `
    <div class="msg ${m.role} ${m.socratic ? 'socratic' : ''}">
      ${md(m.text).value}
      ${refs.length ? `<div class="chat-chips" style="margin-top:10px">
        ${refs.map((tp) => `<a class="pill" href="#/learn/${tp.id}">${loc(tp)} ${icon('arrowRight')}</a>`).join('')}
      </div>` : ''}
      ${(m.chips || []).length ? `<div class="chat-chips">
        ${m.chips.map((c) => c.action.startsWith('learn:')
          ? `<a class="btn btn-sm btn-accent" href="#/learn/${c.action.slice(6)}">${c.label}</a>`
          : `<span class="pill">${c.label}</span>`).join('')}
      </div>` : ''}
    </div>`;
}

async function ask(text, rerender) {
  log.push({ role: 'me', text });
  busy = true;
  rerender();
  scrollDown();

  const p = getProfile();
  const s = getSettings();
  // Контекст: если ученик оставил открытым задание, репетитор ведёт по нему.
  const ctx = getActiveItem() || {};
  let reply;
  try {
    if (s.cloudAI && s.apiKey) {
      reply = await answerWithClaude(text, p, ctx, lang(), s.apiKey);
    } else {
      // Небольшая пауза — чтобы ответ читался как диалог, а не как мгновенный дамп.
      await new Promise((r) => setTimeout(r, 320));
      reply = answerLocally(text, p, ctx, lang());
    }
  } catch (e) {
    reply = answerLocally(text, p, ctx, lang());
    reply.text = tf('tutor.cloudFail', { e: e.message }) + '\n\n' + reply.text;
  }
  log.push({ role: 'bot', ...reply });
  busy = false;
  rerender();
  scrollDown();
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

  action('toggle-ai', () => {
    const s = getSettings();
    if (!s.cloudAI && !s.apiKey) return toast(t('tutor.needKey'));
    update((st) => { st.settings.cloudAI = !st.settings.cloudAI; });
    toast(t(getSettings().cloudAI ? 'tutor.cloudOn' : 'tutor.offlineOn'));
    rerender();
  });

  action('save-key', () => {
    const el = document.getElementById('apiKey');
    update((st) => { st.settings.apiKey = el.value.trim(); });
    toast(t(el.value.trim() ? 'tutor.keySaved' : 'tutor.keyCleared'));
  });

  action('noop', () => {});
}

/** Вызывается роутером: вопрос, переданный из другой страницы через ?q=. */
export function flushPending(rerender) {
  if (!pendingQuestion) return;
  const q = pendingQuestion;
  pendingQuestion = null;
  ask(tf('tutor.explainTopic', { q }), rerender);
}
