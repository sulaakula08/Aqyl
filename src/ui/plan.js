import { html, raw, action } from './dom.js';
import { icon } from './icons.js';
import { t, loc } from '../i18n.js';
import { getProfile, update } from '../state.js';
import { buildRoadmap, daysUntil } from '../engine/planner.js';
import { masteryBand } from '../engine/mastery.js';
import { GOALS } from '../data/curriculum.js';

let weeklyHours = 5;

/** Русское склонение по числу: 1 час, 2 часа, 5 часов. */
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function renderPlan() {
  const p = getProfile();
  const plan = buildRoadmap(p, weeklyHours);
  const days = daysUntil(p.examDate);
  const goal = GOALS.find((g) => g.id === p.goal);

  return html`
  <div class="page wrap">
    <div class="page-head">
      <div>
        <span class="label label-accent">${t('plan.title')}</span>
        <h1 style="font-size:2rem;margin-top:14px">Маршрут до цели</h1>
        <p style="margin-top:6px;max-width:64ch">
          Темы расставлены топологической сортировкой графа знаний: предпосылка всегда идёт раньше следствия.
          Часы на тему зависят от твоего текущего уровня и её сложности — план пересчитывается после каждого решённого задания.
        </p>
      </div>
    </div>

    <div class="grid g4" style="margin-bottom:20px">
      <div class="panel"><div class="metric"><b>${loc(goal)}</b><span>цель</span></div></div>
      <div class="panel"><div class="metric"><b>${String(plan.totalHours)} ч</b><span>объём работы</span></div></div>
      <div class="panel"><div class="metric"><b>${String(plan.weeksNeeded)}</b><span>недель при ${String(weeklyHours)} ч/нед</span></div></div>
      <div class="panel"><div class="metric">
        <b style="color:${days === null ? 'var(--text)' : plan.onTrack ? 'var(--band-mastered)' : 'var(--band-gap)'}">
          ${days === null ? '—' : days + ' ' + t('dash.days')}
        </b><span>${t('dash.deadline')}</span>
      </div></div>
    </div>

    ${raw(days !== null ? `
      <div class="panel panel-accent" style="margin-bottom:20px">
        <h3 style="margin-bottom:8px;display:flex;align-items:center;gap:9px">
          <span class="fb-mark" style="color:${plan.onTrack ? 'var(--band-mastered)' : 'var(--band-gap)'}">${icon(plan.onTrack ? 'check' : 'cross', 16)}</span>
          ${plan.onTrack ? t('plan.ontrack') : t('plan.behind')}
        </h3>
        <p style="font-size:.94rem">
          ${plan.onTrack
            ? `При ${weeklyHours} ч в неделю ты закроешь программу за ${plan.weeksNeeded} нед., а до экзамена ${plan.weeksAvailable} нед. Запас — ${Math.max(0, plan.weeksAvailable - plan.weeksNeeded)} нед. на повторение.`
            : `Чтобы успеть за ${plan.weeksAvailable} нед., нужно заниматься <strong style="color:var(--accent)">${plan.requiredWeeklyHours} ч в неделю</strong> вместо ${weeklyHours}. Либо сузить цель до приоритетных тем.`}
        </p>
      </div>` : `
      <div class="panel" style="margin-bottom:20px">
        <p>Укажи дату экзамена в профиле — и план автоматически уложится в оставшееся время, а система скажет, успеваешь ли ты.</p>
        <a class="btn btn-sm" style="margin-top:12px" href="#/onboarding">Указать дату</a>
      </div>`)}

    <div class="panel" style="margin-bottom:20px">
      <label style="font-size:.79rem;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--text-faint)">
        Сколько часов в неделю ты готов заниматься
      </label>
      <div class="choice-row" style="margin-top:12px">
        ${raw([2, 3, 5, 8, 12].map((h) => `
          <button class="choice ${weeklyHours === h ? 'on' : ''}" data-act="plan-hours" data-h="${h}">${h} ч</button>`).join(''))}
      </div>
    </div>

    <section class="panel">
      <h3 style="margin-bottom:6px">Недельный маршрут</h3>
      <p style="font-size:.86rem;margin-bottom:10px">
        ${String(plan.weeks.length)} ${plural(plan.weeks.length, 'неделя', 'недели', 'недель')} ·
        ${String(plan.totalHours)} ${plural(plan.totalHours, 'час', 'часа', 'часов')}
      </p>
      ${raw(plan.weeks.length ? plan.weeks.map((w, i) => `
        <div class="week">
          <div>
            <div class="week-n">${t('plan.week')} ${i + 1}</div>
            <div class="faint" style="font-size:.78rem;margin-top:3px">${w.hours} ${t('plan.hours')}</div>
          </div>
          <div>
            <div class="week-topics">
              ${w.topics.map((x) => `
                <a class="pill pill-${masteryBand(x.pL)}" href="#/learn/${x.id}">
                  ${loc(x.topic)} · ${Math.round(x.pL * 100)}% · ${x.hours} ${t('plan.hours')}
                </a>`).join('')}
            </div>
          </div>
        </div>`).join('') : '<p>Все темы твоего уровня освоены выше 85%. Можно переходить к олимпиадным задачам или темам следующего класса.</p>')}
    </section>

    <div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">
      <a class="btn btn-primary" href="#/dashboard">${t('nav.dashboard')} →</a>
      <button class="btn btn-ghost" data-act="plan-print">Распечатать план</button>
    </div>
  </div>`;
}

export function registerPlanActions(rerender) {
  action('plan-hours', ({ h }) => { weeklyHours = Number(h); rerender(); });
  action('plan-print', () => window.print());
}
