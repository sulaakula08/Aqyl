import { html, raw, action } from './dom.js';
import { icon, iconGlyph } from './icons.js';
import { t, loc } from '../i18n.js';
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
      return `<path class="gedge ${hl ? 'hl' : ''} ${dim ? 'gdim' : ''}"
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
        <h1 style="font-size:2rem;margin-top:14px">Что от чего зависит</h1>
        <p style="margin-top:6px;max-width:62ch">${t('graph.sub')} Размер узла — уровень освоения, цвет — статус. Это не украшение: именно по этим рёбрам движок ищет первопричину пробела.</p>
      </div>
    </div>

    <div class="grid g4" style="margin-bottom:18px">
      <div class="panel panel-tight"><div class="metric"><b>${String(topics.length)}</b><span>тем в графе</span></div></div>
      <div class="panel panel-tight"><div class="metric"><b>${String(edgeCount)}</b><span>связей «нужно раньше»</span></div></div>
      <div class="panel panel-tight"><div class="metric"><b>${String(open)}</b><span>тем открыто</span></div></div>
      <div class="panel panel-tight"><div class="metric"><b style="color:${blocked ? 'var(--band-gap)' : 'var(--text)'}">${String(blocked)}</b><span>заблокировано базой</span></div></div>
    </div>

    <div class="graph-shell">
      <svg viewBox="0 0 ${String(Math.round(width))} ${String(Math.round(height))}"
           preserveAspectRatio="xMidYMid meet" role="img" aria-label="Граф знаний">
        ${raw(edges)}
        ${raw(nodes)}
      </svg>
    </div>

    <div class="legend">
      <span><i style="background:var(--band-gap)"></i>${t('band.gap')}</span>
      <span><i style="background:var(--band-developing)"></i>${t('band.developing')}</span>
      <span><i style="background:var(--band-strong)"></i>${t('band.strong')}</span>
      <span><i style="background:var(--band-mastered)"></i>${t('band.mastered')}</span>
      <span class="legend-lock">${raw(icon('lock'))} не хватает базы</span>
    </div>

    ${raw(sel ? nodePanel(p, sel) : `
      <div class="panel" style="margin-top:20px">
        <p>Нажми на любой узел, чтобы увидеть путь к нему и текущий уровень освоения.</p>
      </div>`)}

    <section class="section" style="padding-bottom:0">
      <div class="section-head">
        <span class="section-num">01</span>
        <h2>Как читать эту карту</h2>
        <p>
          Граф — не иллюстрация к продукту, а его структура данных. Всё, что показано ниже,
          движок вычисляет на этих же рёбрах: рекомендации, план подготовки и приоритет темы для учителя.
        </p>
      </div>

      <div class="steps">
        <article>
          <span class="step-num">Слева направо</span>
          <h3>Порядок изучения</h3>
          <p>
            Столбец узла — длина самого длинного пути к нему от темы без предпосылок.
            Поэтому предпосылка всегда левее следствия, и картинка читается как учебная траектория,
            а не как случайное облако точек. Глубина этого графа — ${String(longestChain)} ${longestChain % 10 === 1 && longestChain !== 11 ? 'уровень' : longestChain % 10 >= 2 && longestChain % 10 <= 4 && (longestChain < 12 || longestChain > 14) ? 'уровня' : 'уровней'}.
          </p>
        </article>
        <article>
          <span class="step-num">Размер</span>
          <h3>Уровень освоения</h3>
          <p>
            Радиус растёт вместе с P(освоено) — вероятностью, что вы владеете темой прямо сейчас.
            Оценка падает со временем, если тему давно не трогали, поэтому маленький узел
            может означать не «не учил», а «забыл».
          </p>
        </article>
        <article>
          <span class="step-num">Цвет</span>
          <h3>Статус, а не оценка</h3>
          <p>
            Четыре полосы вместо балла: пробел, в процессе, уверенно, освоено.
            Балл «68 %» ничего не говорит о том, что делать дальше; полоса говорит —
            и совпадает с цветами в кабинете и в панели учителя.
          </p>
        </article>
        <article>
          <span class="step-num">Замок</span>
          <h3>Не хватает базы</h3>
          <p>
            Тему можно открыть в любой момент — платформа ничего не запрещает.
            Замок означает лишь, что предпосылки освоены слабее 50 %, и шанс справиться
            низкий: разумнее сначала спуститься по стрелкам вниз.
          </p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <span class="section-num">02</span>
        <h2>Что движок делает с этим графом</h2>
        <p>Три разные задачи решаются обходом одной и той же структуры — поэтому продукт остаётся объяснимым.</p>
      </div>

      <div class="grid g3">
        <div class="panel">
          <span class="label label-accent">Поиск первопричины</span>
          <h3 style="margin:12px 0 8px">Обход вниз по рёбрам</h3>
          <p style="font-size:.9rem">
            От проваленной темы движок спускается к её предпосылкам и продолжает, пока находит
            освоение ниже порога. Возвращается не «слабая тема», а цепочка — и её видно в рекомендациях.
          </p>
          <div class="formula">weakest(t) = argmin&nbsp;P(освоено) по prereq(t)</div>
        </div>
        <div class="panel">
          <span class="label label-accent">Порядок в плане</span>
          <h3 style="margin:12px 0 8px">Топологическая сортировка</h3>
          <p style="font-size:.9rem">
            План подготовки — линеаризация графа: тема не может попасть в неделю раньше своей
            предпосылки. Поэтому маршрут никогда не предлагает параболу до квадратных уравнений.
          </p>
          <div class="formula">order = topo_sort(V, E), E = prereq → topic</div>
        </div>
        <div class="panel">
          <span class="label label-accent">Приоритет для учителя</span>
          <h3 style="margin:12px 0 8px">Число зависимых тем</h3>
          <p style="font-size:.9rem">
            Исходящая степень узла показывает, сколько тем откроется, если закрыть эту.
            Отсюда берётся ранжирование в панели учителя: один урок на узле с высокой степенью
            разблокирует сразу несколько последующих.
          </p>
          <div class="formula">leverage(t) = (1 − avg P) × (1 + outdeg(t))</div>
        </div>
      </div>

      <p class="faint" style="font-size:.82rem;margin-top:18px;max-width:70ch">
        Граф собран по программе Казахстана для 7–11 классов и хранится как обычные данные
        (<span class="mono">src/data/curriculum.js</span>): темы, их предпосылки и задания с параметром сложности.
        Учитель может дописать свой модуль в панели класса — движок начнёт учитывать его сразу, без переобучения.
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
      <span class="pill">готовность базы ${Math.round(ready * 100)}%</span>
    </div>
    <p style="font-size:.94rem">${loc(tp.summary)}</p>
    ${chain.length > 1 ? `
      <div class="chain" style="margin-top:14px">
        <span class="faint">Путь:</span>
        ${chain.map((id, i) => `${i ? '<span class="arrow">→</span>' : ''}<b>${loc(TOPIC_BY_ID[id])}</b>`).join('')}
      </div>
      <p style="font-size:.86rem;margin-top:10px">Система советует стартовать с <strong style="color:var(--accent)">${loc(TOPIC_BY_ID[chain[0]])}</strong>: без неё эта тема не удержится.</p>` : ''}
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <a class="btn btn-primary btn-sm" href="#/learn/${chain[0]}">${t('cta.practice')} →</a>
      <a class="btn btn-ghost btn-sm" href="#/tutor?q=${encodeURIComponent(loc(tp))}">Спросить репетитора</a>
    </div>
  </div>`;
}

export function registerGraphActions(rerender) {
  action('graph-node', ({ id }) => {
    selected = selected === id ? null : id;
    rerender();
  });
}
