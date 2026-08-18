import { html, raw, action, toast, speak } from './dom.js';
import { icon } from './icons.js';
import { t, loc, speechLocale } from '../i18n.js';
import { getProfile, getSettings, recordAttempt } from '../state.js';
import { pickItem, masteryOf, successChance, causeChain } from '../engine/recommender.js';
import { masteryBand } from '../engine/mastery.js';
import { feedbackFor } from '../engine/tutor.js';
import { TOPIC_BY_ID, ITEMS_BY_TOPIC, UNLOCKS } from '../data/curriculum.js';

const KEYS = ['A', 'B', 'C', 'D'];
const BLOCK = 3; // заданий в одном блоке практики

let ses = null;

export function resetLearn() { ses = null; }

/**
 * Задание, над которым ученик работает прямо сейчас.
 * Репетитор использует это, чтобы включить сократовский режим вместо
 * выдачи готового ответа.
 */
export function getActiveItem() {
  if (!ses || !ses.item || ses.revealed || ses.finished) return null;
  return { item: ses.item, hintLevel: ses.hintLevel, topicId: ses.topicId };
}

function ensure(topicId) {
  if (ses && ses.topicId === topicId) return ses;
  const p = getProfile();
  ses = {
    topicId, seen: [], solved: 0, correct: 0, hintLevel: 0,
    selected: null, revealed: false, finished: false,
    startPL: masteryOf(p, topicId), startedAt: Date.now(),
  };
  ses.item = pickItem(p, topicId, []);
  return ses;
}

export function renderLearn(topicId) {
  const topic = TOPIC_BY_ID[topicId];
  if (!topic) return html`<div class="page wrap"><h1>Тема не найдена</h1><a class="btn" href="#/dashboard">${t('cta.back')}</a></div>`;

  const s = ensure(topicId);
  const p = getProfile();
  const pL = masteryOf(p, topicId);
  const band = masteryBand(pL);

  if (s.finished || !s.item) return renderSummary(topic, s, pL, band);

  const chance = successChance(p.theta, s.item.b);

  return html`
  <div class="page wrap">
    <div class="quiz">
      <a class="crumb" href="#/dashboard">${raw(icon('arrowLeft'))} ${t('nav.dashboard')}</a>

      <div class="page-head" style="margin-top:12px">
        <div>
          <h1 style="font-size:1.7rem">${loc(topic)}</h1>
          <p style="margin-top:6px;font-size:.92rem">${loc(topic.summary)}</p>
        </div>
        <div style="text-align:right">
          <span class="pill pill-${band}">${t('band.' + band)} · ${String(Math.round(pL * 100))}%</span>
        </div>
      </div>

      ${raw(topic.prereq.length ? `
        <div class="chain" style="margin-bottom:18px">
          <span class="faint">Опирается на:</span>
          ${topic.prereq.map((id) => `<a href="#/learn/${id}"><b>${loc(TOPIC_BY_ID[id])}</b></a> <span class="mono faint">${Math.round(masteryOf(p, id) * 100)}%</span>`).join('<span class="arrow">·</span>')}
        </div>` : '')}

      <div class="quiz-progress">
        ${raw(Array.from({ length: BLOCK }, (_, i) =>
          `<i class="${i < s.solved ? (s.results?.[i] ? 'done' : 'miss') : i === s.solved ? 'now' : ''}"></i>`).join(''))}
      </div>

      <div class="panel">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="pill mono">b = ${s.item.b.toFixed(1)}</span>
            <span class="pill">${t('learn.chance')} ${String(Math.round(chance * 100))}%</span>
          </div>
          <button class="icon-btn" data-act="speak" title="${t('common.listen')}" aria-label="${t('common.listen')}">${raw(icon('sound', 16))}</button>
        </div>

        <p class="stem" id="stemText">${loc(s.item.stem)}</p>

        <div class="options">
          ${raw(s.item.options.map((o, i) => {
            let cls = '';
            if (s.revealed) {
              if (i === s.item.answer) cls = 'ok';
              else if (i === s.selected) cls = 'bad';
            } else if (i === s.selected) cls = 'sel';
            return `<button class="option ${cls}" data-act="learn-pick" data-i="${i}" ${s.revealed ? 'disabled' : ''}>
                      <span class="key">${KEYS[i]}</span><span>${loc(o)}</span>
                    </button>`;
          }).join(''))}
        </div>

        ${raw(s.hintLevel > 0 && !s.revealed ? hintBlock(s) : '')}
        ${raw(s.revealed ? feedbackBlock(s) : '')}

        <div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">
          ${raw(s.revealed
            ? `<button class="btn btn-primary" data-act="learn-next">${s.solved >= BLOCK ? t('cta.finish') : t('cta.next')} →</button>`
            : `<button class="btn btn-primary" data-act="learn-check" ${s.selected === null ? 'disabled' : ''}>${t('cta.check')}</button>
               <button class="btn btn-ghost" data-act="learn-hint" ${s.hintLevel >= s.item.hints.length ? 'disabled' : ''}>
                 ${icon('hint', 16)} ${t('cta.hint')} ${s.hintLevel > 0 ? `(${s.hintLevel}/${s.item.hints.length})` : ''}
               </button>`)}
          <a class="btn btn-ghost" href="#/tutor?q=${encodeURIComponent(loc(topic))}">Спросить репетитора</a>
        </div>
      </div>

      <p class="faint" style="font-size:.8rem;margin-top:14px;text-align:center">
        Подсказки не блокируют прогресс, но уменьшают начисляемый опыт: система поощряет самостоятельное решение.
      </p>
    </div>
  </div>`;
}

function hintBlock(s) {
  const hints = s.item.hints.slice(0, s.hintLevel);
  return hints.map((h, i) => `
    <div class="hint-box">
      <div class="label label-accent">${icon('hint')} ${t('cta.hint')} ${i + 1}</div>
      <p style="margin-top:6px;color:var(--text)">${loc(h)}</p>
    </div>`).join('');
}

function feedbackBlock(s) {
  const fb = feedbackFor(s.item, s.selected);
  return `
    <div class="feedback ${fb.correct ? 'ok' : 'bad'}">
      <h4><span class="fb-mark">${icon(fb.correct ? 'check' : 'cross', 15)}</span> ${fb.title}
        ${s.gained ? `<span class="delta up">+${s.gained} XP</span>` : ''}
        <span class="delta ${s.dPL >= 0 ? 'up' : 'down'}">P(освоено) ${s.dPL >= 0 ? '+' : ''}${(s.dPL * 100).toFixed(0)}%</span>
      </h4>
      ${fb.misconception ? `<p style="margin-bottom:8px"><strong style="color:var(--band-gap)">${t('learn.misconception')}:</strong> ${fb.misconception}</p>` : ''}
      <p><strong style="color:var(--text)">${t('learn.explain')}.</strong> ${fb.body}</p>
    </div>`;
}

function renderSummary(topic, s, pL, band) {
  const p = getProfile();
  const gain = pL - s.startPL;
  const unlocked = (UNLOCKS[topic.id] || []).filter((id) => {
    const tt = TOPIC_BY_ID[id];
    return tt.prereq.every((pr) => masteryOf(p, pr) >= 0.55);
  });
  const chain = causeChain(p, topic.id);

  return html`
  <div class="page wrap">
    <div class="quiz">
      <span class="label label-accent">Блок завершён</span>
      <h1 style="font-size:1.9rem;margin:14px 0 8px">${loc(topic)}</h1>
      <p>${String(s.correct)} из ${String(s.solved)} верно · подсказок использовано: ${String(s.totalHints || 0)}</p>

      <div class="panel" style="margin-top:22px">
        <div style="display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:8px">
          <span>Освоение темы</span>
          <span class="mono">${String(Math.round(s.startPL * 100))}% → <strong style="color:var(--text)">${String(Math.round(pL * 100))}%</strong>
            <span class="delta ${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? '+' : ''}${(gain * 100).toFixed(0)}</span>
          </span>
        </div>
        <div class="bar bar-${band}"><i style="width:${(pL * 100).toFixed(0)}%"></i></div>
        <p style="font-size:.85rem;margin-top:12px">
          Оценка обновлена моделью Bayesian Knowledge Tracing с учётом вероятности угадывания (${'22'}%) и случайной ошибки (10%).
          Следующее повторение рекомендовано через ${String(p.mastery[topic.id]?.nextReviewDays ?? 3)} дн.
        </p>
      </div>

      ${raw(unlocked.length ? `
        <div class="panel panel-accent" style="margin-top:18px">
          <span class="label label-accent">Открыто</span>
          <h3 style="margin:12px 0 8px">Тебе стали доступны новые темы</h3>
          <div class="week-topics">
            ${unlocked.map((id) => `<a class="pill pill-strong" href="#/learn/${id}">${loc(TOPIC_BY_ID[id])} →</a>`).join('')}
          </div>
        </div>` : '')}

      ${raw(chain.length > 1 ? `
        <div class="panel" style="margin-top:18px">
          <h3 style="margin-bottom:10px">Что мешает двигаться дальше</h3>
          <div class="chain">
            ${chain.map((id, i) => `${i ? '<span class="arrow">→</span>' : ''}<a href="#/learn/${id}"><b>${loc(TOPIC_BY_ID[id])}</b></a>`).join('')}
          </div>
        </div>` : '')}

      <div style="display:flex;gap:10px;margin-top:24px;flex-wrap:wrap">
        <button class="btn btn-primary" data-act="learn-again">Ещё блок</button>
        <a class="btn btn-ghost" href="#/dashboard">${t('nav.dashboard')}</a>
        <a class="btn btn-ghost" href="#/graph">${t('graph.title')}</a>
      </div>
    </div>
  </div>`;
}

export function registerLearnActions(rerender) {
  action('learn-pick', ({ i }) => {
    if (ses.revealed) return;
    ses.selected = Number(i);
    rerender();
  });

  action('learn-hint', () => {
    if (ses.hintLevel < ses.item.hints.length) {
      ses.hintLevel += 1;
      ses.totalHints = (ses.totalHints || 0) + 1;
      rerender();
    }
  });

  action('learn-check', () => {
    if (ses.selected === null || ses.revealed) return;
    const before = masteryOf(getProfile(), ses.topicId);
    const correct = ses.selected === ses.item.answer;
    const { gained } = recordAttempt({
      item: ses.item, chosen: ses.selected, correct,
      hintsUsed: ses.hintLevel, ms: Date.now() - ses.startedAt,
    });
    ses.gained = correct ? gained : 0;
    ses.dPL = masteryOf(getProfile(), ses.topicId) - before;
    ses.revealed = true;
    ses.solved += 1;
    ses.correct += correct ? 1 : 0;
    (ses.results = ses.results || []).push(correct);
    rerender();
  });

  action('learn-next', () => {
    if (ses.solved >= BLOCK) { ses.finished = true; rerender(); return; }
    ses.seen.push(ses.item.id);
    const next = pickItem(getProfile(), ses.topicId, ses.seen);
    if (!next) { ses.finished = true; rerender(); return; }
    ses.item = next;
    ses.selected = null;
    ses.revealed = false;
    ses.hintLevel = 0;
    ses.startedAt = Date.now();
    rerender();
  });

  action('learn-again', () => {
    const id = ses.topicId;
    ses = null;
    ensure(id);
    // Если все задания темы уже пройдены — начинаем круг заново.
    if (!ses.item) { ses.seen = []; ses.item = (ITEMS_BY_TOPIC[id] || [])[0]; }
    rerender();
  });

  action('speak', () => {
    if (!getSettings().tts) return toast('Озвучка выключена в настройках');
    const el = document.getElementById('stemText');
    if (el && !speak(el.textContent, speechLocale())) toast('Браузер не поддерживает озвучку');
  });
}
