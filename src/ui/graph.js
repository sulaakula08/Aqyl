import { html, raw, action } from './dom.js';
import { icon, iconGlyph } from './icons.js';
import { mascot } from './mascot.js';
import { t, tf, loc, plt } from '../i18n.js';
import { getProfile } from '../state.js';
import { masteryOf, causeChain, readinessOf } from '../engine/recommender.js';
import { masteryBand } from '../engine/mastery.js';
import { TOPICS, TOPIC_BY_ID } from '../data/curriculum.js';

let selected = null;

const BAND_COLOR = {
  gap: 'var(--band-gap)', developing: 'var(--band-developing)',
  strong: 'var(--band-strong)', mastered: 'var(--band-mastered)',
};

/**
 * Раскладка графа: слой узла = длина самого длинного пути из корня.
 * Это гарантирует, что предпосылка всегда левее следствия — читается как
 * учебная траектория слева направо.
 */
function layout(topics) {
  const depth = {};
  const calc = (id, guard = new Set()) => {
    if (depth[id] !== undefined) return depth[id];
    if (guard.has(id)) return 0;
    guard.add(id);
    const t = TOPIC_BY_ID[id];
    const d = t.prereq.length ? 1 + Math.max(...t.prereq.map((p) => calc(p, guard))) : 0;
    depth[id] = d;
    return d;
  };
  topics.forEach((t) => calc(t.id));

  const layers = {};
  topics.forEach((t) => (layers[depth[t.id]] = layers[depth[t.id]] || []).push(t));

  const colW = 200, rowH = 92, padX = 90, padY = 60;
  const maxRows = Math.max(...Object.values(layers).map((l) => l.length));
  const pos = {};
  Object.entries(layers).forEach(([d, list]) => {
    const offset = (maxRows - list.length) / 2;
    list.forEach((t, i) => {
      pos[t.id] = { x: padX + Number(d) * colW, y: padY + (offset + i) * rowH };
    });
  });

  return {
    pos,
    // Самая длинная цепочка предпосылок = число слоёв. Свойство самого графа,
    // а не текущего ученика — в отличие от causeChain().
    longestChain: Object.keys(layers).length,
    width: padX * 2 + Object.keys(layers).length * colW - colW + 120,
    height: padY * 2 + maxRows * rowH - rowH + 40,
  };
}

/**
 * Подпись узла в две строки.
 *
 * Раньше длинное название просто обрезалось на 24-м символе, и половина
 * тем на карте читалась как «Парабола и квадратичная…» — то есть именно то,
 * ради чего на карту и смотрят, пропадало. SVG сам текст не переносит,
 * поэтому переносим по словам в <tspan>: две строки помещаются в шаг сетки
 * (rowH = 92), а многоточие остаётся только для действительно длинных имён.
 */
const LABEL_CHARS = 22;

function wrapLabel(label, maxChars = LABEL_CHARS, maxLines = 2) {
  if (label.length <= maxChars) return [label];

  const lines = [];
  let line = '';
  for (const word of label.split(' ')) {
    if (!line) { line = word; continue; }
    if ((line + ' ' + word).length <= maxChars) { line += ' ' + word; continue; }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  // Остаток — последняя строка; если он всё ещё длиннее нормы, режем с многоточием.
  const rest = label.slice(lines.join(' ').length).trim();
  lines.push(rest.length > maxChars ? rest.slice(0, maxChars - 1) + '…' : rest);
  return lines;
}

export function renderGraph() {
  const p = getProfile();
  const subjects = p.subjects?.length ? p.subjects : ['math'];
  const topics = TOPICS.filter((x) => subjects.includes(x.subject));
  const ids = new Set(topics.map((x) => x.id));
  const { pos, width, height, longestChain } = layout(topics);

  const highlight = selected ? new Set(causeChain(p, selected).concat([selected])) : null;

  const edges = topics.flatMap((t) =>
    t.prereq.filter((pr) => ids.has(pr)).map((pr) => {
      const a = pos[pr], b = pos[t.id];
      const hl = highlight && highlight.has(pr) && highlight.has(t.id);
      const dim = highlight && !hl;
      const mx = (a.x + b.x) / 2;
      return `<path class="gedge ${hl ? 'hl' : ''} ${dim ? 'gdim' : ''}" data-from="${pr}" data-to="${t.id}"
                    d="M${a.x + 20} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 20} ${b.y}"/>`;
    })
  ).join('');

  const nodes = topics.map((tp) => {
    const pL = masteryOf(p, tp.id);
    const band = masteryBand(pL);
    const c = pos[tp.id];
    const isSel = selected === tp.id;
    const dim = highlight && !highlight.has(tp.id);
    const ready = readinessOf(p, tp.id);
    const r = 11 + pL * 8;
    const label = loc(tp);
    const lines = wrapLabel(label);
    return `
      <g class="gnode ${isSel ? 'active' : ''} ${dim ? 'gdim' : ''}" data-act="graph-node" data-id="${tp.id}"
         role="button" tabindex="0" aria-label="${label}">
        <circle class="hit" cx="${c.x}" cy="${c.y}" r="22" fill="transparent"/>
        <circle cx="${c.x}" cy="${c.y}" r="${r + 7}" fill="${BAND_COLOR[band]}" opacity="${isSel ? 0.28 : 0.1}"/>
        <circle cx="${c.x}" cy="${c.y}" r="${r}" fill="${BAND_COLOR[band]}"
                stroke="${isSel ? 'var(--text)' : 'transparent'}" stroke-width="2"/>
        ${ready < 0.5 ? `<g class="glock">${iconGlyph('lock', c.x, c.y, 13)}</g>` : ''}
        <text x="${c.x}" y="${c.y + r + 14}" text-anchor="middle">${
          lines.map((ln, i) => `<tspan x="${c.x}" dy="${i ? 11 : 0}">${ln}</tspan>`).join('')
        }</text>
      </g>`;
  }).join('');

  const sel = selected ? TOPIC_BY_ID[selected] : null;

  /* Числа под графом считаются из него самого, а не вписаны руками:
     если учитель добавит свой модуль, строка обновится сама. */
  const edgeCount = topics.reduce((n, x) => n + x.prereq.filter((pr) => ids.has(pr)).length, 0);
  const blocked = topics.filter((x) => readinessOf(p, x.id) < 0.5).length;
  const open = topics.length - blocked;

  return html`
  <div class="page wrap">
    <div class="page-head">
      <div>
        <span class="label label-accent">${t('graph.title')}</span>
        <h1 style="font-size:2rem;margin-top:14px">${t('graph.h1')}</h1>
        <p style="margin-top:6px;max-width:62ch">${t('graph.sub')} ${t('graph.sub2')}</p>
      </div>
      <div class="mascot-slot" data-mascot="graph" data-size="md"></div>
    </div>

    <div class="grid g4" style="margin-bottom:18px">
      <div class="panel panel-tight"><div class="metric"><b>${String(topics.length)}</b><span>${t('graph.mTopics')}</span></div></div>
      <div class="panel panel-tight"><div class="metric"><b>${String(edgeCount)}</b><span>${t('graph.mEdges')}</span></div></div>
      <div class="panel panel-tight"><div class="metric"><b>${String(open)}</b><span>${t('graph.mOpen')}</span></div></div>
      <div class="panel panel-tight"><div class="metric"><b style="color:${blocked ? 'var(--band-gap)' : 'var(--text)'}">${String(blocked)}</b><span>${t('graph.mBlocked')}</span></div></div>
    </div>

    <div class="graph-shell">
      <svg viewBox="0 0 ${String(Math.round(width))} ${String(Math.round(height))}"
           preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t('graph.aria')}">
        ${raw(edges)}
        ${raw(nodes)}
      </svg>
    </div>

    <div class="legend">
      <span><i style="background:var(--band-gap)"></i>${t('band.gap')}</span>
      <span><i style="background:var(--band-developing)"></i>${t('band.developing')}</span>
      <span><i style="background:var(--band-strong)"></i>${t('band.strong')}</span>
      <span><i style="background:var(--band-mastered)"></i>${t('band.mastered')}</span>
      <span class="legend-lock">${raw(icon('lock'))} ${t('graph.legendLock')}</span>
    </div>

    ${raw(sel ? nodePanel(p, sel) : `
      <div class="panel" style="margin-top:20px">
        <p>${t('graph.hint')}</p>
      </div>`)}

    <section class="section" style="padding-bottom:0">
      <div class="section-head">
        <span class="section-num">01</span>
        <h2>${t('graph.readH')}</h2>
        <p>
          ${t('graph.readP')}
        </p>
      </div>

      <div class="steps">
        <article>
          <span class="step-num">${t('graph.r1n')}</span>
          <h3>${t('graph.r1h')}</h3>
          <p>
            ${tf('graph.r1b', { n: longestChain, w: plt(longestChain, 'pl.level') })}
          </p>
        </article>
        <article>
          <span class="step-num">${t('graph.r2n')}</span>
          <h3>${t('graph.r2h')}</h3>
          <p>
            ${t('graph.r2b')}
          </p>
        </article>
        <article>
          <span class="step-num">${t('graph.r3n')}</span>
          <h3>${t('graph.r3h')}</h3>
          <p>
            ${t('graph.r3b')}
          </p>
        </article>
        <article>
          <span class="step-num">${t('graph.r4n')}</span>
          <h3>${t('graph.r4h')}</h3>
          <p>
            ${t('graph.r4b')}
          </p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <span class="section-num">02</span>
        <h2>${t('graph.useH')}</h2>
        <p>${t('graph.useP')}</p>
      </div>

      <div class="grid g3">
        <div class="panel">
          <span class="label label-accent">${t('graph.u1l')}</span>
          <h3 style="margin:12px 0 8px">${t('graph.u1h')}</h3>
          <p style="font-size:.9rem">
            ${t('graph.u1b')}
          </p>
          <div class="formula">${raw(t('graph.u1f'))}</div>
        </div>
        <div class="panel">
          <span class="label label-accent">${t('graph.u2l')}</span>
          <h3 style="margin:12px 0 8px">${t('graph.u2h')}</h3>
          <p style="font-size:.9rem">
            ${t('graph.u2b')}
          </p>
          <div class="formula">order = topo_sort(V, E), E = prereq → topic</div>
        </div>
        <div class="panel">
          <span class="label label-accent">${t('graph.u3l')}</span>
          <h3 style="margin:12px 0 8px">${t('graph.u3h')}</h3>
          <p style="font-size:.9rem">
            ${t('graph.u3b')}
          </p>
          <div class="formula">leverage(t) = (1 − avg P) × (1 + outdeg(t))</div>
        </div>
      </div>

      <p class="faint" style="font-size:.82rem;margin-top:18px;max-width:70ch">
        ${raw(tf('graph.dataNote', { file: '<span class="mono">src/data/curriculum.js</span>' }))}
      </p>
    </section>
  </div>`;
}

function nodePanel(p, tp) {
  const pL = masteryOf(p, tp.id);
  const band = masteryBand(pL);
  const chain = causeChain(p, tp.id);
  const ready = readinessOf(p, tp.id);

  return `
  <div class="panel panel-accent" style="margin-top:20px">
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <h3>${loc(tp)}</h3>
      <span class="pill pill-${band}">${t('band.' + band)} · ${Math.round(pL * 100)}%</span>
      <span class="pill">${tp.grade} ${t('common.grade')}</span>
      <span class="pill">${t('graph.ready')} ${Math.round(ready * 100)}%</span>
    </div>
    <p style="font-size:.94rem">${loc(tp.summary)}</p>
    ${chain.length > 1 ? `
      <div class="chain" style="margin-top:14px">
        <span class="faint">${t('graph.path')}</span>
        ${chain.map((id, i) => `${i ? '<span class="arrow">→</span>' : ''}<b>${loc(TOPIC_BY_ID[id])}</b>`).join('')}
      </div>
      <p style="font-size:.86rem;margin-top:10px">${raw(tf('graph.advise', { topic: `<strong style="color:var(--accent)">${loc(TOPIC_BY_ID[chain[0]])}</strong>` }))}</p>` : ''}
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <a class="btn btn-primary btn-sm" href="#/learn/${chain[0]}">${t('cta.practice')} →</a>
      <a class="btn btn-ghost btn-sm" href="#/tutor?q=${encodeURIComponent(loc(tp))}">${t('graph.askTutor')}</a>
    </div>
  </div>`;
}

export function registerGraphActions(rerender) {
  action('graph-node', ({ id }) => {
    selected = selected === id ? null : id;
    rerender();
    if (!selected) return;

    /* Реакция на выбранный узел — это и есть тезис продукта, показанный
       телом: персонаж тревожится не за оценку, а за тему, на которой всё
       сломалось. Освоенная тема получает спокойную гордость. */
    const p = getProfile();
    const pL = masteryOf(p, selected);
    if (pL < 0.4) mascot.fire('worried');
    else if (pL >= 0.85) mascot.fire('proud');
    else mascot.fire('nod');

    flyTheChain(p, selected);
  });
}

/**
 * Персонаж пролетает цепочку причин прямо по карте.
 *
 * Это главное утверждение продукта, до сих пор существовавшее только текстом:
 * «ты заваливаешь не эту тему, а ту, что под ней». Стрелочки в панели под
 * графом объясняют это правильно и совершенно не убеждают — их не читают.
 * Птица, которая срывается с выбранного узла и по одному спускается до
 * самого нижнего, объясняет то же самое за две секунды и без единого слова.
 *
 * Порядок обратный тому, что отдаёт causeChain(): та возвращает цепочку от
 * корня к симптому, а лететь нужно наоборот — от того, что ученик выбрал, к
 * тому, что он не выбирал и о чём не подозревает. Направление здесь и есть
 * содержание.
 *
 * Полёта нет, если цепочка из одного узла: лететь некуда, и «эффектная»
 * анимация ради самой себя тут была бы враньём — она сообщала бы о находке,
 * которой не было.
 */
function flyTheChain(profile, topicId) {
  if (!mascot.enabled() || mascot.calm()) return;

  const chain = causeChain(profile, topicId);
  if (chain.length < 2) return;

  const nodes = [...chain].reverse()
    .map((id) => document.querySelector(`.gnode[data-id="${id}"]`))
    .filter(Boolean);
  if (nodes.length < 2) return;

  /* Ток по ребру.
     Персонаж не просто перелетает от узла к узлу — под ним по связи бежит
     светящийся отрезок, ровно в те же полсекунды. Ребро графа перестаёт быть
     линией на схеме и становится дорогой, по которой знание перетекает
     снизу вверх. Смотреть на это можно бесконечно, а объясняет оно ту же
     самую мысль: темы держатся друг на друге. */
  const ids = [...chain].reverse();
  ids.slice(0, -1).forEach((from, i) => {
    setTimeout(() => sparkEdge(ids[i + 1], from), i * (520 + 380));
  });

  mascot.flyPath(nodes, {
    size: 'sm',
    step: 520,
    hold: 380,
    // На последнем узле — тревога: это и есть найденная причина.
    onDone: () => mascot.fire('worried'),
  });
}

/** Светящийся отрезок пробегает по ребру между двумя темами. */
function sparkEdge(fromId, toId) {
  const edge = document.querySelector(`.gedge[data-from="${fromId}"][data-to="${toId}"]`)
    || document.querySelector(`.gedge[data-from="${toId}"][data-to="${fromId}"]`);
  if (!edge) return;

  const spark = edge.cloneNode();
  spark.setAttribute('class', 'gedge gspark');
  spark.removeAttribute('data-from');
  spark.removeAttribute('data-to');
  edge.parentNode.appendChild(spark);

  const len = spark.getTotalLength();
  const seg = Math.max(26, len * 0.22);
  spark.style.strokeDasharray = `${seg} ${len}`;
  spark.animate(
    [{ strokeDashoffset: len }, { strokeDashoffset: -seg }],
    { duration: 620, easing: 'cubic-bezier(.4,0,.5,1)' },
  ).finished.catch(() => {}).then(() => spark.remove());
}
