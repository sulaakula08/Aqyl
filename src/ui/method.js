import { html, raw } from './dom.js';
import { t, tf } from '../i18n.js';
import { getProfile } from '../state.js';
import { BKT } from '../engine/mastery.js';
import { successChance } from '../engine/recommender.js';

/**
 * Страница «Как устроен ИИ».
 *
 * Отдельный экран нужен по двум причинам. Во-первых, объяснимость — заявленное
 * свойство продукта, и её нельзя прятать в README. Во-вторых, на защите проекта
 * жюри спрашивает про архитектуру моделей: здесь всё выложено с формулами
 * и живыми числами текущего пользователя.
 */

/** Символ в моноширинном начертании — подставляется в переводимые строки. */
const mono = (s) => `<span class="mono">${s}</span>`;

function bktTable() {
  // Показываем, как одна и та же попытка двигает оценку с разных стартовых точек.
  const rows = [0.2, 0.5, 0.8];
  const { p_slip: s, p_guess: g, p_transit: tr } = BKT;
  const step = (pL, correct) => {
    const post = correct
      ? (pL * (1 - s)) / (pL * (1 - s) + (1 - pL) * g)
      : (pL * s) / (pL * s + (1 - pL) * (1 - g));
    return post + (1 - post) * tr;
  };
  return rows.map((pL) => `
    <tr>
      <td class="mono">${pL.toFixed(2)}</td>
      <td class="mono" style="color:var(--band-mastered)">${step(pL, true).toFixed(2)}</td>
      <td class="mono" style="color:var(--band-gap)">${step(pL, false).toFixed(2)}</td>
    </tr>`).join('');
}

const LIMITS = ['lim1', 'lim2', 'lim3'];

export function renderMethod() {
  const p = getProfile();
  const theta = p.theta ?? 0;
  const params = { g: mono('g = ' + BKT.p_guess), s: mono('s = ' + BKT.p_slip), tau: mono('τ = ' + BKT.p_transit) };

  return html`
  <div class="page wrap">
    <div class="page-head">
      <div>
        <span class="label label-accent">${t('method.kicker')}</span>
        <h1 style="margin-top:12px">${t('method.h1')}</h1>
        <p>${t('method.lead')}</p>
      </div>
    </div>

    <div class="grid g2" style="align-items:start;gap:26px">

      <section class="panel">
        <span class="label label-accent">${t('method.s1label')}</span>
        <h3 style="margin:12px 0 10px">${t('method.s1h')}</h3>
        <p style="font-size:.93rem">${t('method.s1p')}</p>

        <div class="formula">${t('method.fBayes')}</div>
        <div class="formula">${raw(t('method.fUpdate'))}</div>

        <p style="font-size:.88rem">${raw(tf('method.s1params', params))}</p>

        <table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:.85rem">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule)" class="label">${t('method.thWas')}</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule)" class="label">${t('method.thRight')}</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule)" class="label">${t('method.thWrong')}</th>
            </tr>
          </thead>
          <tbody>${raw(bktTable())}</tbody>
        </table>
        <p style="font-size:.82rem;margin-top:12px;color:var(--text-faint)">${t('method.s1note')}</p>
      </section>

      <section class="panel">
        <span class="label label-accent">${t('method.s2label')}</span>
        <h3 style="margin:12px 0 10px">${t('method.s2h')}</h3>
        <p style="font-size:.93rem">${raw(tf('method.s2p', { theta: mono('θ'), b: mono('b') }))}</p>

        <div class="formula">${t('method.fElo')}</div>
        <div class="formula">${raw(t('method.fTheta'))}</div>

        <p style="font-size:.88rem">${raw(tf('method.s2k', {
          theta: mono('θ = ' + (theta >= 0 ? '+' : '') + theta.toFixed(2)),
          n: p.attempts,
          w: t(p.attempts === 1 ? 'method.attempt1' : 'method.attemptN'),
        }))}</p>

        <div style="margin-top:16px;display:grid;gap:9px">
          ${raw([-1, 0, 0.5, 1, 1.5].map((b) => {
            const pc = Math.round(successChance(theta, b) * 100);
            return `<div class="progress-row">
              <div class="top"><span>${t('method.taskDiff')} ${mono('b = ' + b.toFixed(1))}</span><span class="mono">${pc}%</span></div>
              <div class="bar bar-strong"><i style="width:${pc}%"></i></div>
            </div>`;
          }).join(''))}
        </div>
        <p style="font-size:.82rem;margin-top:12px;color:var(--text-faint)">${t('method.s2note')}</p>
      </section>

      <section class="panel">
        <span class="label label-accent">${t('method.s3label')}</span>
        <h3 style="margin:12px 0 10px">${t('method.s3h')}</h3>
        <p style="font-size:.93rem">${t('method.s3p')}</p>

        <p style="font-size:.92rem;margin-top:14px"><strong style="color:var(--text)">${t('method.s3aT')}</strong>
        ${raw(t('method.s3aB'))}</p>

        <p style="font-size:.92rem;margin-top:12px"><strong style="color:var(--text)">${t('method.s3bT')}</strong>
        ${raw(tf('method.s3bB', { theta: mono('θ'), b: mono('b') }))}</p>
        <div class="formula">${t('method.fCeil')}</div>
        <div class="formula">${t('method.fFloor')}</div>
        <p style="font-size:.88rem">${t('method.s3note')}</p>
      </section>

      <section class="panel">
        <span class="label label-accent">${t('method.s4label')}</span>
        <h3 style="margin:12px 0 10px">${t('method.s4h')}</h3>
        <p style="font-size:.93rem">${t('method.s4p')}</p>

        <p style="font-size:.92rem;margin-top:14px"><strong style="color:var(--text)">${t('method.s4aT')}</strong>
        ${t('method.s4aB')}</p>

        <p style="font-size:.92rem;margin-top:12px"><strong style="color:var(--text)">${t('method.s4bT')}</strong>
        ${t('method.s4bB')}</p>

        <div class="panel panel-accent panel-tight" style="margin-top:16px">
          <span class="label">${t('method.whyLabel')}</span>
          <p style="font-size:.9rem;margin-top:8px;color:var(--text)">${t('method.whyB')}</p>
        </div>
      </section>
    </div>

    <section class="panel panel-sunk" style="margin-top:26px">
      <span class="label label-accent">${t('method.limLabel')}</span>
      <h3 style="margin:12px 0 12px">${t('method.limH')}</h3>
      <div class="grid g3" style="gap:18px">
        ${raw(LIMITS.map((k) => `
          <p style="font-size:.9rem"><strong style="color:var(--text)">${t('method.' + k + 'T')}</strong>
          ${tf('method.' + k + 'B', params)}</p>`).join(''))}
      </div>
    </section>

    <div class="row" style="margin-top:26px">
      <a class="btn btn-primary" href="#/onboarding">${t('cta.diagnostic')}</a>
      <a class="btn btn-ghost" href="#/graph">${t('method.ctaGraph')}</a>
    </div>
  </div>`;
}
