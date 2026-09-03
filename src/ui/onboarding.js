import { html, raw, action, toast } from './dom.js';
import { icon } from './icons.js';
import { mascot } from './mascot.js';
import { cue } from './sound.js';
import { t, tf, loc } from '../i18n.js';
import { getProfile, update } from '../state.js';
import { SUBJECTS, GOALS } from '../data/curriculum.js';

const REGIONS = [
  'reg.astana', 'reg.almaty', 'reg.shymkent', 'reg.turkestan', 'reg.kyzylorda',
  'reg.aktobe', 'reg.zhambyl', 'reg.vko', 'reg.pavlodar', 'reg.atyrau', 'reg.other',
];

export function renderOnboarding() {
  const p = getProfile();

  return html`
  <div class="page wrap" style="max-width:720px">
    <div class="page-head">
      <div>
        <span class="label label-accent">${t('onb.step')}</span>
        <h1 style="font-size:2rem;margin-top:14px">${t('onb.title')}</h1>
        <p style="margin-top:8px">${t('onb.lead')}</p>
      </div>
      <!-- Персонаж сидит рядом с заголовком и никуда не летает.
           Сначала он перелетал от поля к полю — и на ноутбуке садился прямо
           на соседний ввод: события он не перехватывал, но поле закрывал,
           и ученик не видел, что печатает. Анкета — плотная сетка полей, на
           ней место персонажа фиксировано; вести за собой он будет там, где
           для этого есть простор (экскурсия, карта знаний). -->
      <div class="mascot-slot" data-mascot="onboarding" data-size="md"></div>
    </div>

    <form class="panel" data-act="onb-submit" id="onbForm">
      <div class="grid g2" style="gap:0 20px">
        <div class="field">
          <label for="f-name">${t('onb.name')}</label>
          <input class="input" id="f-name" name="name" value="${p.name}" placeholder="${t('onb.namePh')}" autocomplete="given-name">
        </div>
        <div class="field">
          <label for="f-grade">${t('onb.grade')}</label>
          <select class="input" id="f-grade" name="grade">
            ${raw([7, 8, 9, 10, 11, 12].map((g) => `<option value="${g}" ${g === p.grade ? 'selected' : ''}>${g} ${t('common.grade')}</option>`).join(''))}
          </select>
        </div>
      </div>

      <div class="grid g2" style="gap:0 20px">
        <div class="field">
          <label for="f-region">${t('onb.region')}</label>
          <select class="input" id="f-region" name="region">
            ${raw(REGIONS.map((r) => `<option value="${r}" ${r === p.region ? 'selected' : ''}>${t(r)}</option>`).join(''))}
          </select>
        </div>
        <div class="field">
          <label for="f-school">${t('onb.school')}</label>
          <input class="input" id="f-school" name="school" value="${p.school}" placeholder="${t('onb.schoolPh')}">
        </div>
      </div>

      <div class="field">
        <label>${t('onb.subject')}</label>
        <div class="choice-row" id="subjectRow">
          ${raw(SUBJECTS.map((s) => `
            <button type="button" class="choice ${p.subjects.includes(s.id) ? 'on' : ''}"
                    data-act="toggle-subject" data-id="${s.id}">
              ${icon(s.icon, 15)} ${loc(s)}
            </button>`).join(''))}
        </div>
      </div>

      <div class="field">
        <label>${t('onb.goal')}</label>
        <div class="choice-row" id="goalRow">
          ${raw(GOALS.map((g) => `
            <button type="button" class="choice ${p.goal === g.id ? 'on' : ''}"
                    data-act="pick-goal" data-id="${g.id}">${loc(g)}</button>`).join(''))}
        </div>
      </div>

      <div class="field">
        <label for="f-exam">${t('onb.exam')}</label>
        <input class="input" id="f-exam" name="examDate" type="date" value="${p.examDate}">
        <span class="faint" style="font-size:.8rem">${t('onb.examNote')}</span>
      </div>

      <button class="btn btn-primary btn-block" type="submit" style="margin-top:10px">
        ${t('cta.diagnostic')} →
      </button>

    </form>
  </div>`;
}

/**
 * Реакции анкеты.
 *
 * Персонаж на анкете НЕ перелетает от поля к полю — он сидит в гнезде у
 * заголовка. Летающий над плотной сеткой полей персонаж рано или поздно
 * оказывается поверх соседнего ввода: клики он не перехватывает (слой не
 * ловит события), но поле закрывает собой, и ученик перестаёт видеть, что
 * набирает. Никакая геометрия расстановки этого не лечит — лечит решение
 * не летать там, где у человека работа с полями.
 *
 * Остаётся то, что помогает и ничего не загораживает: кивок на каждый
 * сделанный выбор и приветствие по имени.
 */
let greeted = false;

function greetOnce(nameInput) {
  const name = nameInput.value.trim();
  if (!name || greeted) return;
  greeted = true;
  mascot.say(tf('mascot.greetName', { name }));
  mascot.fire('nod');
}

export function registerOnboardingActions(navigate) {
  document.addEventListener('change', (e) => {
    if (e.target.id === 'f-name') greetOnce(e.target);
  });

  action('toggle-subject', ({ id }, el) => {
    update((s) => {
      const list = s.profile.subjects;
      const i = list.indexOf(id);
      if (i >= 0 && list.length > 1) list.splice(i, 1);
      else if (i < 0) list.push(id);
    });
    el.classList.toggle('on', getProfile().subjects.includes(id));
    mascot.fire('nod');
    cue('hint');
  });

  action('pick-goal', ({ id }, el) => {
    update((s) => { s.profile.goal = id; });
    el.parentElement.querySelectorAll('.choice').forEach((c) => c.classList.toggle('on', c === el));
    mascot.fire('nod');
    cue('hint');
  });

  action('onb-submit', (_d, form) => {
    const data = new FormData(form);
    update((s) => {
      s.profile.name = (data.get('name') || '').toString().trim() || t('onb.defaultName');
      s.profile.grade = Number(data.get('grade'));
      s.profile.region = data.get('region');
      s.profile.school = data.get('school');
      s.profile.examDate = data.get('examDate');
      // Стартовая оценка способности: ученик старшего класса начинает выше.
      if (!s.profile.attempts) s.profile.theta = (s.profile.grade - 9) * 0.22;
      s.ui.onboarded = true;
    });
    toast(t('app.profileSaved'));
    /* Персонаж уходит первым, экран меняется следом: так переход читается
       как «он повёл меня дальше», а не как перезагрузка страницы. */
    mascot.say(t('mascot.ready'));
    mascot.fire('exit');
    greeted = false;
    setTimeout(() => navigate('/diagnostic'), mascot.calm() ? 0 : 420);
  });
}
