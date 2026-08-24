import { html, raw, ring, excerpt } from './dom.js';
import { icon } from './icons.js';
import { t, tf, loc, plt } from '../i18n.js';
import { getProfile, ALL_BADGES } from '../state.js';
import { recommend, weakSpots, masteryOf, successChance } from '../engine/recommender.js';
import { masteryBand } from '../engine/mastery.js';
import { daysUntil } from '../engine/planner.js';
import { TOPICS, TOPIC_BY_ID } from '../data/curriculum.js';

const WHY_LABEL = {
  gap: 'why.gap', blocked: 'why.blocked', goal: 'why.goal',
  leverage: 'why.leverage', review: 'why.review',
};

export function renderDashboard() {
  const p = getProfile();
  if (!p.diagnosticDone && p.attempts === 0) {
    return html`
      <div class="page wrap center" style="max-width:560px">
        <h1 style="font-size:1.9rem">${t('dash.gate')}</h1>
        <p style="margin:12px 0 22px">${t('dash.gateSub')}</p>
        <a class="btn btn-primary" href="#/onboarding">${t('cta.diagnostic')} →</a>
      </div>`;
  }

  const recos = recommend(p, 3);
  const weak = weakSpots(p, 4);
  const subjects = p.subjects?.length ? p.subjects : ['math'];
  const topics = TOPICS.filter((x) => subjects.includes(x.subject));
  const overall = topics.reduce((s, x) => s + masteryOf(p, x.id), 0) / topics.length;
  const days = daysUntil(p.examDate);
  const mastered = topics.filter((x) => masteryOf(p, x.id) >= 0.85).length;

  return html`
  <div class="page wrap">
    <div class="page-head">
      <div>
        <span class="label label-accent">${t(p.region)}${p.school ? ' · ' + p.school : ''}</span>
        <h1 style="font-size:2rem;margin-top:14px">${p.name ? t('dash.hi') + ', ' + p.name : t('dash.hi')}</h1>
        <p style="margin-top:6px">${String(p.grade)} ${t('common.grade')} · ${String(p.attempts)} ${t('dash.solved')} · ${tf('dash.topicsOf', { a: mastered, b: topics.length })}</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn btn-ghost btn-sm" href="#/plan">${t('plan.title')}</a>
        <a class="btn btn-ghost btn-sm" href="#/tutor">${t('tutor.title')}</a>
      </div>
    </div>

    <div class="grid dash-top">
      <div class="panel" style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        ${ring(overall, Math.round(overall * 100) + '%', t('common.mastery'))}
        <div style="display:grid;gap:16px">
          <div class="metric"><b class="mono">θ ${p.theta >= 0 ? '+' : ''}${p.theta.toFixed(2)}</b><span>${t('dash.level')}</span></div>
          <div class="metric"><b>${String(p.xp)}</b><span>${t('dash.xp')}</span></div>
          <div class="metric"><b>${String(p.streakDays)}${raw(p.streakDays >= 3 ? ' <span class="ic-hot">' + icon('flame') + '</span>' : '')}</b><span>${t('dash.streak')}</span></div>
          ${raw(days !== null ? `<div class="metric"><b style="color:var(--accent)">${days} ${t('dash.days')}</b><span>${t('dash.deadline')}</span></div>` : '')}
        </div>
      </div>

      <section class="panel">
        <h3 style="margin-bottom:6px">${t('dash.next')}</h3>
        <p style="font-size:.86rem;margin-bottom:16px">${t('dash.recoNote')}</p>
        <div class="reco">
          ${raw(recos.map((r) => recoCard(p, r)).join(''))}
        </div>
      </section>
    </div>

    <div class="grid g2" style="margin-top:18px">
      <section class="panel">
        <h3 style="margin-bottom:16px">${t('dash.weak')}</h3>
        ${raw(weak.length ? `<div style="display:grid;gap:16px">${weak.map((w) => {
          const topic = TOPIC_BY_ID[w.topicId];
          const band = masteryBand(w.pL);
          return `<div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:.9rem;margin-bottom:6px">
              <a href="#/learn/${w.topicId}" style="text-decoration:underline;text-decoration-color:var(--rule-strong);text-underline-offset:3px">${loc(topic)}</a>
              <span class="pill pill-${band}">${t('band.' + band)} · ${Math.round(w.pL * 100)}%</span>
            </div>
            <div class="bar bar-${band}"><i style="width:${(w.pL * 100).toFixed(0)}%"></i></div>
            <div class="faint" style="font-size:.78rem;margin-top:5px">${w.attempts} ${plt(w.attempts, 'pl.attempt')} · ${topic.summary ? excerpt(loc(topic.summary), 90) : ''}</div>
          </div>`;
        }).join('')}</div>` : `<p>${t('dash.noGaps')}</p>`)}
      </section>

      <section class="panel">
        <h3 style="margin-bottom:16px">${t('dash.progress')}</h3>
        <div style="display:grid;gap:11px;max-height:340px;overflow-y:auto;padding-right:6px">
          ${raw(topics.map((x) => {
            const pL = masteryOf(p, x.id);
            const band = masteryBand(pL);
            return `<div>
              <div style="display:flex;justify-content:space-between;gap:10px;font-size:.85rem;margin-bottom:5px">
                <a href="#/learn/${x.id}">${loc(x)}</a>
                <span class="mono faint">${Math.round(pL * 100)}%</span>
              </div>
              <div class="bar bar-${band}"><i style="width:${(pL * 100).toFixed(0)}%"></i></div>
            </div>`;
          }).join(''))}
        </div>
      </section>
    </div>

    <section class="panel" style="margin-top:18px">
      <h3 style="margin-bottom:14px">${t('dash.badges')}</h3>
      <div class="badge-grid">
        ${raw(ALL_BADGES.map((b) => `
          <span class="badge ${p.badges.includes(b.id) ? '' : 'locked'}">
            ${icon(b.icon, 15)} ${loc(b)}
          </span>`).join(''))}
      </div>
    </section>
  </div>`;
}

function recoCard(p, r) {
  const topic = TOPIC_BY_ID[r.topicId];
  const chance = successChance(p.theta, topic.b);
  const rootDiffers = r.root && r.root !== r.topicId;

  return `
  <article class="reco-item">
    <div>
      <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">
        <strong>${loc(topic)}</strong>
        <span class="pill pill-${r.band}">${t('band.' + r.band)} · ${Math.round(r.pL * 100)}%</span>
        <span class="pill">${topic.grade} ${t('common.grade')}</span>
      </div>
      <p style="font-size:.86rem;margin-top:7px">${loc(topic.summary)}</p>

      <div class="reco-why">
        ${r.reasons.slice(0, 3).map((x, i) => `
          <span class="why-tag ${i === 0 ? 'hot' : ''}">${t(WHY_LABEL[x.key] || x.key)} · ${x.weight > 0 ? '+' : ''}${Math.round(x.weight)}</span>`).join('')}
        <span class="why-tag">${t('learn.chance')} ${Math.round(chance * 100)}%</span>
      </div>

      ${rootDiffers ? `
        <div class="chain">
          <span class="faint">${t('dash.chain')}</span>
          ${r.chain.map((id, i) => `${i ? '<span class="arrow">→</span>' : ''}<b>${loc(TOPIC_BY_ID[id])}</b>`).join('')}
        </div>` : ''}
    </div>
    <a class="btn btn-primary btn-sm" href="#/learn/${rootDiffers ? r.root : r.topicId}">${t('cta.practice')} →</a>
  </article>`;
}
