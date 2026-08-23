import { html, raw, action } from './dom.js';
import { icon } from './icons.js';
import { t, tf, loc, lang } from '../i18n.js';
import { getProfile, update, recordAttempt } from '../state.js';
import { pickDiagnosticItem, masteryOf, rootCause, hasEvidence } from '../engine/recommender.js';
import { masteryBand } from '../engine/mastery.js';
import { TOPIC_BY_ID, TOPICS } from '../data/curriculum.js';

const LENGTH = 8;
const KEYS = ['A', 'B', 'C', 'D'];

/** Состояние текущего прохождения — живёт только в памяти вкладки. */
let session = null;

export function resetDiagnostic() { session = null; }

function ensureSession() {
  if (session) return session;
  const p = getProfile();
  session = {
    asked: [], results: [], current: null, selected: null, revealed: false, done: false,
    startedAt: Date.now(),
    subjects: p.subjects?.length ? p.subjects : ['math'],
  };
  session.current = pickDiagnosticItem(p, [], session.subjects);
  return session;
}

export function renderDiagnostic() {
  const s = ensureSession();
  if (s.done) return renderResult();

  const p = getProfile();
  const item = s.current;
  if (!item) { s.done = true; return renderResult(); }

  const topic = TOPIC_BY_ID[item.topic];

  return html`
  <div class="page wrap">
    <div class="quiz">
      <div class="page-head">
        <div>
          <span class="label label-accent">${t('diag.title')}</span>
          <h1 style="font-size:1.8rem;margin-top:14px">${t('diag.q')} ${String(s.results.length + 1)} ${t('diag.of')} ${String(LENGTH)}</h1>
          <p style="margin-top:6px">${t('diag.sub')}</p>
        </div>
        <div class="metric" style="align-items:flex-end">
          <b class="mono">θ ${p.theta >= 0 ? '+' : ''}${p.theta.toFixed(2)}</b>
          <span>${t('dash.level')}</span>
        </div>
      </div>

      <div class="quiz-progress" aria-label="${t('diag.progressAria')}">
        ${raw(Array.from({ length: LENGTH }, (_, i) => {
          const r = s.results[i];
          const cls = r ? (r.correct ? 'done' : 'miss') : i === s.results.length ? 'now' : '';
          return `<i class="${cls}"></i>`;
        }).join(''))}
      </div>

      <div class="panel">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
          <span class="pill">${loc(topic)}</span>
          <span class="pill">${String(topic.grade)} ${t('common.grade')}</span>
          <span class="pill mono">b = ${item.b.toFixed(1)}</span>
        </div>

        <p class="stem">${loc(item.stem)}</p>

        <div class="options">
          ${raw(item.options.map((o, i) => {
            let cls = '';
            if (s.revealed) {
              if (i === item.answer) cls = 'ok';
              else if (i === s.selected) cls = 'bad';
            } else if (i === s.selected) cls = 'sel';
            return `<button class="option ${cls}" data-act="diag-pick" data-i="${i}" ${s.revealed ? 'disabled' : ''}>
                      <span class="key">${KEYS[i]}</span><span>${loc(o)}</span>
                    </button>`;
          }).join(''))}
        </div>

        ${raw(s.revealed ? feedbackBlock(item, s) : '')}

        <div style="display:flex;gap:10px;margin-top:22px">
          ${raw(s.revealed
            ? `<button class="btn btn-primary" data-act="diag-next">${s.results.length >= LENGTH ? t('diag.result') : t('cta.next')} →</button>`
            : `<button class="btn btn-primary" data-act="diag-check" ${s.selected === null ? 'disabled' : ''}>${t('cta.check')}</button>`)}
          <button class="btn btn-ghost" data-act="diag-skip">${t('cta.skip')}</button>
        </div>
      </div>

      <p class="faint" style="font-size:.8rem;margin-top:16px;text-align:center">
        ${t('diag.adaptNote')}
      </p>
    </div>
  </div>`;
}

function feedbackBlock(item, s) {
  const correct = s.selected === item.answer;
  return `
    <div class="feedback ${correct ? 'ok' : 'bad'}">
      <h4><span class="fb-mark">${icon(correct ? 'check' : 'cross', 15)}</span> ${correct ? t('learn.correct') : t('learn.wrong')}
        <span class="delta ${correct ? 'up' : 'down'}">θ ${s.lastDelta >= 0 ? '+' : ''}${(s.lastDelta || 0).toFixed(2)}</span>
      </h4>
      ${!correct && item.misconception ? `<p style="margin-bottom:8px"><strong style="color:var(--band-gap)">${t('learn.misconception')}:</strong> ${item.misconception}</p>` : ''}
      <p>${loc(item.explain)}</p>
    </div>`;
}

function renderResult() {
  const p = getProfile();
  const subjects = p.subjects?.length ? p.subjects : ['math'];
  const touched = TOPICS
    .filter((x) => subjects.includes(x.subject))
    .map((x) => ({ topic: x, pL: masteryOf(p, x.id), attempts: p.mastery[x.id]?.attempts || 0 }))
    .sort((a, b) => a.pL - b.pL);

  const weakest = touched.find((x) => x.attempts > 0) || touched[0];
  const root = weakest ? rootCause(p, weakest.topic.id) : null;
  const correct = session?.results.filter((r) => r.correct).length ?? 0;

  return html`
  <div class="page wrap">
    <div class="quiz">
      <span class="label label-accent">${t('diag.done')}</span>
      <h1 style="font-size:2rem;margin:14px 0 10px">${t('diag.result')}</h1>
      <p>${tf('diag.doneP', { n: session?.results.length ?? LENGTH })}</p>

      <div class="grid g3" style="margin:26px 0">
        <div class="panel center"><div class="metric" style="align-items:center"><b class="mono">θ ${p.theta >= 0 ? '+' : ''}${p.theta.toFixed(2)}</b><span>${t('dash.level')}</span></div></div>
        <div class="panel center"><div class="metric" style="align-items:center"><b>${String(correct)}/${String(session?.results.length ?? LENGTH)}</b><span>${t('diag.correctAnswers')}</span></div></div>
        <div class="panel center"><div class="metric" style="align-items:center"><b>${String(p.xp)}</b><span>${t('dash.xp')}</span></div></div>
      </div>

      ${raw(root && weakest ? `
        <div class="panel panel-accent" style="margin-bottom:22px">
          <span class="label label-accent">${t('diag.verdict')}</span>
          <h3 style="margin:14px 0 8px">${t('diag.verdictH')}</h3>
          <p style="font-size:.95rem">${t('diag.weakest')} <strong style="color:var(--text)">${loc(weakest.topic)}</strong> (${Math.round(weakest.pL * 100)}%).
          ${root !== weakest.topic.id
            ? tf('diag.deeper', { root: loc(TOPIC_BY_ID[root]) }) + (hasEvidence(p, root) ? '' : t('diag.noEvidence'))
            : weakest.topic.prereq.length ? t('diag.baseOk') : t('diag.fundamental')}</p>
          <a class="btn btn-primary btn-sm" style="margin-top:16px" href="#/learn/${root}">${t('diag.startHere')}</a>
        </div>` : '')}

      <div class="panel">
        <h3 style="margin-bottom:16px">${t('dash.progress')}</h3>
        <div style="display:grid;gap:14px">
          ${raw(touched.map((x) => `
            <div>
              <div style="display:flex;justify-content:space-between;gap:12px;font-size:.88rem;margin-bottom:6px">
                <span>${loc(x.topic)} ${x.attempts === 0 ? `<span class="faint" style="font-size:.78rem">${t('diag.fromGraph')}</span>` : ''}</span>
                <span class="mono faint">${Math.round(x.pL * 100)}%</span>
              </div>
              <div class="bar bar-${masteryBand(x.pL)}"><i style="width:${(x.pL * 100).toFixed(0)}%"></i></div>
            </div>`).join(''))}
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:24px;flex-wrap:wrap">
        <a class="btn btn-primary" href="#/dashboard">${t('diag.toDash')}</a>
        <a class="btn btn-ghost" href="#/plan">${t('plan.title')}</a>
        <a class="btn btn-ghost" href="#/graph">${t('graph.title')}</a>
      </div>
    </div>
  </div>`;
}

export function registerDiagnosticActions(rerender, navigate) {
  action('diag-pick', ({ i }) => {
    if (session.revealed) return;
    session.selected = Number(i);
    rerender();
  });

  action('diag-check', () => {
    const s = session;
    if (s.selected === null || s.revealed) return;
    const item = s.current;
    const correct = s.selected === item.answer;
    const before = getProfile().theta;
    recordAttempt({ item, chosen: s.selected, correct, ms: Date.now() - s.startedAt });
    s.lastDelta = getProfile().theta - before;
    s.revealed = true;
    s.results.push({ itemId: item.id, correct });
    rerender();
  });

  action('diag-next', () => {
    const s = session;
    if (s.results.length >= LENGTH) {
      update((st) => { st.profile.diagnosticDone = true; });
      s.done = true;
      rerender();
      return;
    }
    s.asked.push(s.current.id);
    s.current = pickDiagnosticItem(getProfile(), s.asked, s.subjects);
    s.selected = null;
    s.revealed = false;
    s.startedAt = Date.now();
    if (!s.current) { s.done = true; update((st) => { st.profile.diagnosticDone = true; }); }
    rerender();
  });

  action('diag-skip', () => {
    const s = session;
    s.asked.push(s.current.id);
    s.results.push({ itemId: s.current.id, correct: false, skipped: true });
    if (s.results.length >= LENGTH) {
      update((st) => { st.profile.diagnosticDone = true; });
      s.done = true;
    } else {
      s.current = pickDiagnosticItem(getProfile(), s.asked, s.subjects);
      s.selected = null;
      s.revealed = false;
    }
    rerender();
  });
}
