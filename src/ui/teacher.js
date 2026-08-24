import { html, raw, action, toast, initials } from './dom.js';
import { t, tf, loc, plt } from '../i18n.js';
import { getState, addTeacherModule } from '../state.js';
import { masteryBand } from '../engine/mastery.js';
import { TOPICS, TOPIC_BY_ID } from '../data/curriculum.js';

let subject = 'math';
let showAdd = false;

/**
 * Цвет ячейки тепловой карты. Опорные точки совпадают с семантическими
 * цветами освоения из палитры, поэтому таблица класса читается теми же
 * категориями, что и прогресс отдельного ученика.
 */
const HEAT_STOPS = [
  [0.00, [178, 58, 72]],   // пробел
  [0.45, [176, 125, 16]],  // в процессе
  [0.70, [28, 122, 140]],  // уверенно
  [1.00, [47, 125, 81]],   // освоено
];

function heatColor(pL) {
  let a = HEAT_STOPS[0], b = HEAT_STOPS[HEAT_STOPS.length - 1];
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    if (pL >= HEAT_STOPS[i][0] && pL <= HEAT_STOPS[i + 1][0]) { a = HEAT_STOPS[i]; b = HEAT_STOPS[i + 1]; break; }
  }
  const k = (pL - a[0]) / Math.max(0.0001, b[0] - a[0]);
  const rgb = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * k));
  // Насыщенность растёт вместе с освоением: слабые ячейки бледнее, сильные плотнее.
  return `rgba(${rgb.join(',')},${(0.18 + pL * 0.72).toFixed(2)})`;
}

/**
 * Аналитика класса.
 * Считаем не «средний балл», а то, что учителю действительно нужно:
 * общий пробел класса, ученики в зоне риска и темы, где помощь даст
 * максимальный эффект (низкое освоение × много зависимых тем).
 */
function analyse(klass, subjectId) {
  const topics = TOPICS.filter((x) => x.subject === subjectId);
  const students = klass.students;

  const perTopic = topics.map((tp) => {
    const vals = students.map((s) => s.mastery[tp.id]?.pL ?? 0.25);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const struggling = vals.filter((v) => v < 0.45).length;
    const unlocks = TOPICS.filter((x) => x.prereq.includes(tp.id)).length;
    return { topic: tp, avg, struggling, unlocks, leverage: (1 - avg) * (1 + unlocks) };
  });

  const atRisk = students
    .map((s) => {
      const vals = topics.map((tp) => s.mastery[tp.id]?.pL ?? 0.25);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const active = s.activity.filter((x) => x > 0).length;
      const gaps = vals.filter((v) => v < 0.4).length;
      // Риск = слабое освоение + низкая вовлечённость.
      return { s, avg, active, gaps, risk: (1 - avg) * 0.7 + (1 - active / 14) * 0.3 };
    })
    .sort((a, b) => b.risk - a.risk);

  const classAvg = atRisk.reduce((sum, x) => sum + x.avg, 0) / atRisk.length;
  const priority = [...perTopic].sort((a, b) => b.leverage - a.leverage)[0];
  const strongest = [...perTopic].sort((a, b) => b.avg - a.avg)[0];

  return { topics, perTopic, atRisk, classAvg, priority, strongest };
}

export function renderTeacher() {
  const st = getState();
  const klass = st.klass;
  const a = analyse(klass, subject);

  return html`
  <div class="page wrap">
    <div class="page-head">
      <div>
        <span class="label label-accent">${t('teacher.title')}</span>
        <h1 style="font-size:2rem;margin-top:14px">${t(klass.nameKey)}</h1>
        <p style="margin-top:6px">${t(klass.schoolKey)} · ${klass.teacher} · ${String(klass.students.length)} ${t('teacher.students')}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${raw(['math', 'physics'].map((s) => `
          <button class="choice ${subject === s ? 'on' : ''}" data-act="teach-subject" data-id="${s}">
            ${t(s === 'math' ? 'teacher.math' : 'teacher.physics')}
          </button>`).join(''))}
        <button class="btn btn-primary btn-sm" data-act="teach-add-open">+ ${t('teacher.add')}</button>
      </div>
    </div>

    <div class="grid g4" style="margin-bottom:18px">
      <div class="panel"><div class="metric"><b>${String(Math.round(a.classAvg * 100))}%</b><span>${t('teacher.mAvg')}</span></div></div>
      <div class="panel"><div class="metric"><b style="color:var(--band-gap)">${String(a.atRisk.filter((x) => x.risk > 0.5).length)}</b><span>${t('teacher.risk')}</span></div></div>
      <div class="panel"><div class="metric"><b>${String(a.priority.struggling)}</b><span>${t('teacher.mStruggling')}</span></div></div>
      <div class="panel"><div class="metric"><b>${String(Math.round(klass.students.reduce((s, x) => s + x.activity.reduce((p, q) => p + q, 0), 0)))}</b><span>${t('teacher.mTasks')}</span></div></div>
    </div>

    <section class="panel panel-accent" style="margin-bottom:18px">
      <span class="label label-accent">${t('teacher.insight')}</span>
      <div class="insight" style="margin-top:16px">
        <p><strong style="color:var(--text)">${t('teacher.i1')}</strong>
          ${raw(tf('teacher.i1b', {
            topic: `<strong style="color:var(--accent)">${loc(a.priority.topic)}</strong>`,
            avg: Math.round(a.priority.avg * 100),
            n: a.priority.struggling, w: plt(a.priority.struggling, 'pl.student'),
            u: a.priority.unlocks, uw: plt(a.priority.unlocks, 'pl.topic'),
            dep: plt(a.priority.unlocks, 'pl.depends'),
          }))}</p>
        <p><strong style="color:var(--text)">${t('teacher.i2')}</strong>
          ${raw(a.atRisk.slice(0, 3).map((x) => `${x.s.name} (${Math.round(x.avg * 100)}%, ${t('teacher.activeDays')} ${x.active}/14)`).join(', '))}.
          ${t('teacher.i2b')}</p>
        <p><strong style="color:var(--text)">${t('teacher.i3')}</strong>
          ${tf('teacher.i3b', { topic: loc(a.strongest.topic), avg: Math.round(a.strongest.avg * 100) })}</p>
      </div>
      <p class="faint" style="font-size:.78rem;margin-top:14px">
        ${t('teacher.formula')}
      </p>
    </section>

    <section class="panel" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px">
        <h3>${t('teacher.heatmap')}</h3>
        <div class="legend" style="margin:0">
          ${raw([[0.15, t('band.gap')], [0.5, t('band.developing')], [0.78, t('band.strong')], [0.95, t('band.mastered')]]
            .map(([pL, label]) => `<span><i style="background:${heatColor(pL)}"></i>${label}</span>`).join(''))}
        </div>
      </div>
      <div class="heat-wrap">
        <table class="heat">
          <thead>
            <tr><th class="nm-h" scope="col"><span class="sr-only">${t('teacher.colStudent')}</span></th>${raw(a.topics.map((tp) => `<th class="rot" scope="col"><span>${loc(tp)}</span></th>`).join(''))}</tr>
          </thead>
          <tbody>
            ${raw(klass.students.map((s) => `
              <tr>
                <th class="nm" scope="row">${s.name}</th>
                ${a.topics.map((tp) => {
                  const pL = s.mastery[tp.id]?.pL ?? 0.25;
                  return `<td class="cell" style="background:${heatColor(pL)}"
                              title="${s.name} · ${loc(tp)} · ${Math.round(pL * 100)}%"></td>`;
                }).join('')}
              </tr>`).join(''))}
          </tbody>
        </table>
      </div>
      <p class="faint" style="font-size:.8rem;margin-top:12px">
        ${t('teacher.heatNote')}
      </p>
    </section>

    <div class="grid g2">
      <section class="panel">
        <h3 style="margin-bottom:14px">${t('teacher.risk')}</h3>
        <div style="display:grid;gap:10px">
          ${raw(a.atRisk.slice(0, 6).map((x) => `
            <div class="risk-row">
              <span class="avatar">${initials(x.s.name)}</span>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:.88rem">
                  <strong>${x.s.name}</strong>
                  <span class="pill pill-${masteryBand(x.avg)}">${Math.round(x.avg * 100)}%</span>
                </div>
                <div class="faint" style="font-size:.76rem;margin-top:3px">
                  ${t(x.s.region)} · ${t('teacher.gaps')}: ${x.gaps} · ${t('teacher.activeDays')} ${x.active}/14
                </div>
              </div>
              <div class="spark" title="${t('teacher.sparkTitle')}">
                ${x.s.activity.map((v) => `<i class="${v ? '' : 'zero'}" style="height:${Math.max(2, v * 3)}px"></i>`).join('')}
              </div>
            </div>`).join(''))}
        </div>
      </section>

      <section class="panel">
        <h3 style="margin-bottom:14px">${t('teacher.priorityH')}</h3>
        <div style="display:grid;gap:12px">
          ${raw([...a.perTopic].sort((x, y) => y.leverage - x.leverage).slice(0, 7).map((x) => `
            <div>
              <div style="display:flex;justify-content:space-between;gap:10px;font-size:.86rem;margin-bottom:5px">
                <span>${loc(x.topic)}</span>
                <span class="mono faint">${Math.round(x.avg * 100)}% · ×${x.unlocks + 1}</span>
              </div>
              <div class="bar bar-${masteryBand(x.avg)}"><i style="width:${(x.avg * 100).toFixed(0)}%"></i></div>
            </div>`).join(''))}
        </div>
        <p class="faint" style="font-size:.78rem;margin-top:12px">${t('teacher.multiplier')}</p>
      </section>
    </div>

    ${raw(klass.customModules?.length ? `
      <section class="panel" style="margin-top:18px">
        <h3 style="margin-bottom:14px">${t('teacher.modulesH')}</h3>
        <div style="display:grid;gap:10px">
          ${klass.customModules.map((m) => `
            <div class="risk-row">
              <div style="flex:1">
                <strong>${m.title}</strong>
                <div class="faint" style="font-size:.78rem;margin-top:3px">
                  ${TOPIC_BY_ID[m.topic] ? loc(TOPIC_BY_ID[m.topic]) : m.topic} · ${m.grade} ${t('common.grade')} · ${m.tasks} ${t('teacher.tasksWord')}
                </div>
              </div>
              <span class="pill pill-strong">${t('teacher.published')}</span>
            </div>`).join('')}
        </div>
      </section>` : '')}

    ${raw(showAdd ? addSheet() : '')}
  </div>`;
}

function addSheet() {
  return `
  <div class="sheet" data-act="teach-add-close">
    <form class="sheet-card" data-act="teach-add-submit" onclick="event.stopPropagation()">
      <h3 style="margin-bottom:6px">${t('teacher.add')}</h3>
      <p style="font-size:.88rem;margin-bottom:18px">${t('teacher.addNote')}</p>

      <div class="field">
        <label for="m-title">${t('teacher.fTitle')}</label>
        <input class="input" id="m-title" name="title" required placeholder="${t('teacher.fTitlePh')}">
      </div>
      <div class="field">
        <label for="m-topic">${t('teacher.fTopic')}</label>
        <select class="input" id="m-topic" name="topic">
          ${TOPICS.map((tp) => `<option value="${tp.id}">${loc(tp)} (${tp.grade} ${t('teacher.gradeShort')})</option>`).join('')}
        </select>
      </div>
      <div class="grid g2" style="gap:0 18px">
        <div class="field">
          <label for="m-grade">${t('teacher.fGrade')}</label>
          <select class="input" id="m-grade" name="grade">
            ${[7, 8, 9, 10, 11, 12].map((g) => `<option ${g === 9 ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="m-tasks">${t('teacher.fTasks')}</label>
          <input class="input" id="m-tasks" name="tasks" type="number" min="1" max="50" value="5">
        </div>
      </div>
      <div class="field">
        <label for="m-desc">${t('teacher.fDesc')}</label>
        <textarea class="input" id="m-desc" name="desc" rows="3" placeholder="${t('teacher.fDescPh')}"></textarea>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" type="submit">${t('teacher.publish')}</button>
        <button class="btn btn-ghost" type="button" data-act="teach-add-close">${t('teacher.cancel')}</button>
      </div>
    </form>
  </div>`;
}

export function registerTeacherActions(rerender) {
  action('teach-subject', ({ id }) => { subject = id; rerender(); });
  action('teach-add-open', () => { showAdd = true; rerender(); });
  action('teach-add-close', () => { showAdd = false; rerender(); });

  // Единственное модальное окно в продукте — оно должно закрываться Escape,
  // иначе с клавиатуры из него не выйти.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && showAdd) { showAdd = false; rerender(); }
  });

  action('teach-add-submit', (_d, form) => {
    const f = new FormData(form);
    addTeacherModule({
      title: (f.get('title') || '').toString().trim() || t('teacher.untitled'),
      topic: f.get('topic'),
      grade: Number(f.get('grade')),
      tasks: Number(f.get('tasks')) || 1,
      desc: f.get('desc'),
    });
    showAdd = false;
    toast(t('teacher.publishedToast'));
    rerender();
  });
}
