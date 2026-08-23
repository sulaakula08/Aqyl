import { html, raw } from './dom.js';
import { t } from '../i18n.js';
import { getProfile } from '../state.js';

/**
 * Первый экран показывает не абстрактную иллюстрацию, а реальный вывод
 * продукта: карточку диагноза с спуском по графу предпосылок. Это ровно то,
 * что ученик увидит после диагностики, — поэтому обещание на главной и
 * содержание продукта совпадают.
 */
function diagnosisCard() {
  const steps = [
    { n: '3', band: 'gap', pct: 21, key: 'demo3' },
    { n: '2', band: 'gap', pct: 28, key: 'demo2' },
    { n: '1', band: 'gap', pct: 19, key: 'demo1', root: true },
  ];

  return raw(`
  <figure class="demo-card" style="margin:0">
    <figcaption class="demo-head">
      <span class="demo-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="label">${t('home.demoLabel')}</span>
    </figcaption>
    <div class="demo-body">
      <div class="label" style="margin-bottom:6px">${t('home.demoDiag')}</div>
      <p style="color:var(--text);font-size:1.02rem;font-weight:500;margin-bottom:20px;line-height:1.45">
        ${t('home.demoVerdict')}
      </p>

      <div class="descend">
        ${steps.map((s) => `
          <div class="descend-step ${s.root ? 'is-root' : ''}">
            <div class="tick"><span class="dot">${s.n}</span></div>
            <div class="body">
              <h4>${t('home.' + s.key + 't')} <span class="pill pill-${s.band}">${s.pct}%</span></h4>
              <p>${t('home.' + s.key + 'n')}</p>
            </div>
          </div>`).join('')}
      </div>

      <div class="row" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--rule);gap:14px">
        <span class="label">${t('home.demoRoute')}</span>
        <span style="font-size:.86rem;color:var(--text)">${t('home.demoRouteVal')}</span>
      </div>
    </div>
  </figure>`);
}

// Порядковые номера в вёрстке (01…05) — оформление, а не текст: не переводятся.
const FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5', 'faq6'];
const THEM_KEYS = ['them1', 'them2', 'them3', 'them4', 'them5', 'them6'];
const US_KEYS = ['us1', 'us2', 'us3', 'us4', 'us5', 'us6'];
const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'];
const STUDENT_KEYS = ['st1', 'st2', 'st3', 'st4'];
const TEACHER_KEYS = ['te1', 'te2', 'te3', 'te4'];
const FIGURES = ['fig1', 'fig2', 'fig3', 'fig4'];
const PRINCIPLES = ['p1', 'p2', 'p3'];

/** Пункт списка «Ученику» / «Учителю»: жирный зачин + пояснение. */
const bullet = (k) => `
  <li style="font-size:.92rem;color:var(--text-dim)">
    <strong style="color:var(--text)">${t('home.' + k + 't')}</strong> ${t('home.' + k + 'b')}
  </li>`;

export function renderHome() {
  const p = getProfile();
  const started = p.diagnosticDone || p.attempts > 0;

  return html`
  <div class="page" style="padding-top:0">

    <!-- Первый экран -->
    <section class="hero">
      <div class="wrap hero-grid">
        <div>
          <span class="label label-accent">${t('home.kicker')}</span>
          <h1>${t('home.h1a')}<br>${t('home.h1b')} <u>${t('home.h1u')}</u></h1>
          <p class="hero-lead">${t('home.lead')}</p>

          <div class="hero-cta">
            <a class="btn btn-primary btn-lg" href="#${started ? '/dashboard' : '/onboarding'}">
              ${started ? t('cta.continue') : t('cta.diagnostic')}
            </a>
            <a class="btn btn-lg btn-ghost" href="#/method">${t('app.methodNav')}</a>
          </div>

          <div class="hero-meta">
            <div><b>8</b> ${t('home.meta1')}</div>
            <div><b>3</b> ${t('home.meta2')}</div>
            <div><b>0</b> ${t('home.meta3')}</div>
          </div>
        </div>

        <div>${diagnosisCard()}</div>
      </div>
    </section>

    <!-- Числа -->
    <section class="wrap" style="padding-bottom:20px">
      <div class="figures">
        ${raw(FIGURES.map((f) => `
          <div>
            <div class="fig-num">${t('home.' + f + 'n')}</div>
            <div class="fig-lbl">${t('home.' + f + 'l')}</div>
            <div class="fig-src">${t('home.' + f + 's')}</div>
          </div>`).join(''))}
      </div>
    </section>

    <!-- 01 Проблема -->
    <section class="section wrap">
      <div class="section-head">
        <span class="section-num">01</span>
        <h2>${t('home.s01')}</h2>
        <p>${t('home.s01p')}</p>
      </div>

      <div class="versus">
        <div class="them">
          <h4>${t('home.themTitle')}</h4>
          <ul>${raw(THEM_KEYS.map((k) => `<li>${t('home.' + k)}</li>`).join(''))}</ul>
        </div>
        <div class="us">
          <h4>AQYL</h4>
          <ul>${raw(US_KEYS.map((k) => `<li>${t('home.' + k)}</li>`).join(''))}</ul>
        </div>
      </div>
    </section>

    <!-- 02 Как это работает -->
    <section class="section wrap">
      <div class="section-head">
        <span class="section-num">02</span>
        <h2>${t('home.s02')}</h2>
      </div>

      <div class="steps">
        ${raw(STEP_KEYS.map((k, i) => `
          <article>
            <span class="step-num">${t('home.step')} ${String(i + 1).padStart(2, '0')}</span>
            <h3>${t('home.' + k + 't')}</h3>
            <p>${t('home.' + k + 'b')}</p>
          </article>`).join(''))}
      </div>
    </section>

    <!-- 03 Что внутри -->
    <section class="section wrap">
      <div class="section-head">
        <span class="section-num">03</span>
        <h2>${t('home.s03')}</h2>
        <p>${t('home.s03p')}</p>
      </div>

      <div class="grid g2">
        <div class="panel">
          <span class="label">${t('home.forStudent')}</span>
          <h3 style="margin:12px 0 14px">${t('home.studentH')}</h3>
          <ul style="list-style:none;padding:0;display:grid;gap:11px">
            ${raw(STUDENT_KEYS.map(bullet).join(''))}
          </ul>
          <div class="row" style="margin-top:20px">
            <a class="btn btn-sm" href="#/dashboard">${t('home.openDash')}</a>
            <a class="btn btn-sm btn-ghost" href="#/graph">${t('nav.graph')}</a>
          </div>
        </div>

        <div class="panel">
          <span class="label">${t('home.forTeacher')}</span>
          <h3 style="margin:12px 0 14px">${t('home.teacherH')}</h3>
          <ul style="list-style:none;padding:0;display:grid;gap:11px">
            ${raw(TEACHER_KEYS.map(bullet).join(''))}
          </ul>
          <div class="row" style="margin-top:20px">
            <a class="btn btn-sm" href="#/teacher">${t('home.openTeacher')}</a>
          </div>
        </div>
      </div>
    </section>

    <!-- 04 Принципы -->
    <section class="section wrap">
      <div class="section-head">
        <span class="section-num">04</span>
        <h2>${t('home.s04')}</h2>
      </div>

      <div class="grid g3">
        ${raw(PRINCIPLES.map((k) => `
          <div class="panel panel-sunk">
            <span class="label label-accent">${t('home.' + k + 'l')}</span>
            <h3 style="margin:12px 0 10px">${t('home.' + k + 'h')}</h3>
            <p style="font-size:.92rem">${t('home.' + k + 'b')}</p>
          </div>`).join(''))}
      </div>
    </section>

    <!-- 05 FAQ -->
    <section class="section wrap">
      <div class="section-head">
        <span class="section-num">05</span>
        <h2>${t('home.s05')}</h2>
      </div>

      <div class="faq narrow" style="margin:0">
        ${raw(FAQ_KEYS.map((k, i) => `
          <details ${i === 0 ? 'open' : ''}>
            <summary>${t('home.' + k + 'q')}</summary>
            <p>${t('home.' + k + 'a')}</p>
          </details>`).join(''))}
      </div>
    </section>

    <!-- Финальный призыв -->
    <section class="section wrap">
      <div class="panel panel-accent" style="display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between;padding:34px">
        <div>
          <h2 style="font-size:1.7rem;margin-bottom:8px">${t('home.finalH')}</h2>
          <p style="max-width:52ch">${t('home.finalP')}</p>
        </div>
        <a class="btn btn-primary btn-lg" href="#/onboarding">${t('home.finalCta')}</a>
      </div>
    </section>
  </div>`;
}
