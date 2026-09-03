/**
 * Сократовский AI-репетитор AQYL.
 *
 * Два режима работы, переключаются в настройках:
 *
 *  • Offline-режим (по умолчанию) — весь диалог считается прямо в браузере:
 *    поиск по учебному графу (BM25-подобное ранжирование) + педагогическая
 *    политика ответа. Работает без интернета и без токенов, что критично
 *    для сельских школ с нестабильной связью. Это и есть наш «edge-AI».
 *
 *  • Cloud-режим — тот же контекст (найденные темы, карта пробелов ученика,
 *    текущее задание) уходит на наш эндпоинт /api/tutor, а тот — в Gemini.
 *    Ключ остаётся на сервере: сайт публичный, в браузер его класть нельзя.
 *
 * Главное правило политики: репетитор НИКОГДА не выдаёт готовый ответ на
 * задание, пока ученик не исчерпал лестницу подсказок. Он задаёт встречный
 * вопрос — так работает метод Сократа и так растёт реальное понимание.
 */

import { TOPICS, TOPIC_BY_ID, ITEMS_BY_TOPIC } from '../data/curriculum.js';
import { masteryOf, rootCause } from './recommender.js';

const STOP = new Set(['как', 'что', 'это', 'для', 'при', 'если', 'мне', 'меня', 'the', 'and', 'what', 'how', 'бір', 'және']);

const tokenize = (s) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

/** Поиск релевантных тем по вопросу ученика. */
export function retrieve(query, lang = 'ru', limit = 3) {
  const q = tokenize(query);
  if (!q.length) return [];
  const scored = TOPICS.map((t) => {
    const doc = tokenize(
      [t[lang] || t.ru, t.summary?.[lang] || t.summary?.ru || '',
       ...(ITEMS_BY_TOPIC[t.id] || []).map((i) => i.stem[lang] || i.stem.ru)].join(' ')
    );
    const bag = new Map();
    doc.forEach((w) => bag.set(w, (bag.get(w) || 0) + 1));
    let score = 0;
    q.forEach((w) => {
      if (bag.has(w)) score += 1 + Math.log(bag.get(w));
      // частичное совпадение — ловим словоформы («уравнение» / «уравнения»)
      else if (doc.some((d) => d.startsWith(w.slice(0, Math.max(4, w.length - 2))))) score += 0.6;
    });
    return { topic: t, score: score / Math.sqrt(doc.length || 1) };
  });
  return scored.filter((s) => s.score > 0.02).sort((a, b) => b.score - a.score).slice(0, limit);
}

const INTENTS = [
  { id: 'answer', re: /(ответ|шешу|решение|solve|подскажи ответ|жауап)/i },
  { id: 'explain', re: /(объясни|почему|зачем|түсіндір|explain|why|не понимаю|түсінбей)/i },
  { id: 'plan', re: /(план|с чего начать|роадмап|жоспар|plan|подготов)/i },
  { id: 'weak', re: /(слаб|пробел|отстаю|осал|weak|что подтянуть)/i },
  { id: 'motivation', re: /(не получается|устал|сдаюсь|тяжело|шаршадым|give up|боюсь)/i },
];

export function classify(text) {
  return INTENTS.find((i) => i.re.test(text))?.id || 'explain';
}

/**
 * Локальный ответ репетитора.
 * @returns {{text:string, chips:Array, refs:Array, socratic:boolean}}
 */
export function answerLocally(text, profile, ctx = {}, lang = 'ru') {
  const intent = classify(text);
  const hits = retrieve(text, lang);
  const top = hits[0]?.topic;

  // Просит ответ, но задание не открыто — вести к решению нечего.
  if (intent === 'answer' && !ctx.item) {
    return {
      socratic: true,
      text: pick(lang, {
        ru: 'Готовые ответы я не выдаю — от них не остаётся понимания. Открой задание в теме, и я проведу тебя по нему вопросами: от первой наводки до момента, когда решишь сам.',
        kk: 'Дайын жауап бермеймін — одан түсінік қалмайды. Тақырыптағы тапсырманы аш, мен сені сұрақтармен өзің шешетін сәтке дейін жетелеймін.',
        en: 'I do not hand out answers — nothing is learned that way. Open a task and I will walk you through it with questions.',
      }),
      chips: top ? [{ label: pick(lang, { ru: 'Открыть тему', kk: 'Тақырыпты ашу', en: 'Open topic' }), action: `learn:${top.id}` }] : [],
      refs: top ? [top.id] : [],
    };
  }

  // Ученик просит готовый ответ прямо во время задания — включаем метод Сократа.
  if (intent === 'answer' && ctx.item) {
    const step = Math.min(ctx.hintLevel ?? 0, ctx.item.hints.length - 1);
    return {
      socratic: true,
      text: pick(lang, {
        ru: `Я не дам готовый ответ — иначе задание ничему тебя не научит. Давай разберём вместе.\n\n**${ctx.item.hints[step][lang] || ctx.item.hints[step].ru}**\n\nПопробуй ответить на этот вопрос, и я подскажу дальше.`,
        kk: `Дайын жауап бермеймін — әйтпесе тапсырма саған ештеңе үйретпейді. Бірге талдайық.\n\n**${ctx.item.hints[step].kk || ctx.item.hints[step].ru}**\n\nОсы сұраққа жауап беріп көр, мен әрі қарай бағыттаймын.`,
        en: `I won't hand you the answer — the task would teach you nothing. Let's work through it.\n\n**${ctx.item.hints[step].ru}**`,
      }),
      chips: [{ label: pick(lang, { ru: 'Следующая подсказка', kk: 'Келесі нұсқау', en: 'Next hint' }), action: 'hint' }],
      refs: top ? [top.id] : [],
    };
  }

  if (intent === 'weak' || intent === 'plan') {
    const weak = TOPICS
      .filter((t) => (profile.subjects || ['math']).includes(t.subject))
      .map((t) => ({ t, pL: masteryOf(profile, t.id) }))
      .sort((a, b) => a.pL - b.pL)
      .slice(0, 3);
    const root = weak[0] ? rootCause(profile, weak[0].t.id) : null;
    const list = weak.map((w, i) => `${i + 1}. **${w.t[lang] || w.t.ru}** — ${Math.round(w.pL * 100)}%`).join('\n');
    return {
      socratic: false,
      text: pick(lang, {
        ru: `Вот что показывает твоя карта знаний:\n\n${list}\n\nПо графу ближайшая точка входа — «${TOPIC_BY_ID[root]?.ru}»: её база уже держит, поэтому результат будет виден сразу. Это примерно 2 занятия.`,
        kk: `Сенің білім картаң мынаны көрсетеді:\n\n${list}\n\nГраф бойынша ең жақын кіру нүктесі — «${TOPIC_BY_ID[root]?.kk}»: оның негізі дайын, сондықтан нәтиже бірден көрінеді.`,
        en: `Your knowledge map shows:\n\n${list}\n\nThe nearest entry point on the graph is "${TOPIC_BY_ID[root]?.en || TOPIC_BY_ID[root]?.ru}" — its foundation already holds.`,
      }),
      chips: root ? [{ label: pick(lang, { ru: 'Открыть тему', kk: 'Тақырыпты ашу', en: 'Open topic' }), action: `learn:${root}` }] : [],
      refs: weak.map((w) => w.t.id),
    };
  }

  if (intent === 'motivation') {
    const solved = Object.values(profile.mastery || {}).reduce((s, m) => s + (m.correct || 0), 0);
    return {
      socratic: false,
      text: pick(lang, {
        ru: `Это нормальная часть обучения — мозг растёт именно в момент, когда трудно.\n\nПосмотри на факты: ты уже решил **${solved}** заданий и поднял свой уровень до **${(profile.theta ?? 0).toFixed(2)}**. Давай снизим сложность на один шаг и возьмём короткий блок из 3 заданий. Согласен?`,
        kk: `Бұл — оқудың қалыпты бөлігі. Ми дәл қиын сәтте өседі.\n\nФактілерге қара: сен қазірдің өзінде **${solved}** тапсырма шештің. Қиындықты бір саты төмендетіп, 3 тапсырмадан тұратын қысқа блок алайық.`,
        en: `This is a normal part of learning. You've already solved **${solved}** tasks. Let's drop one difficulty step and take a short 3-task block.`,
      }),
      chips: [{ label: pick(lang, { ru: 'Лёгкий блок', kk: 'Жеңіл блок', en: 'Easier block' }), action: 'easier' }],
      refs: [],
    };
  }

  // Объяснение темы.
  if (top) {
    const pL = masteryOf(profile, top.id);
    const example = (ITEMS_BY_TOPIC[top.id] || [])[0];
    return {
      socratic: false,
      text: pick(lang, {
        ru: `**${top.ru}** (${top.grade} класс)\n\n${top.summary?.ru || ''}\n\nТвой текущий уровень по этой теме — **${Math.round(pL * 100)}%**.${top.prereq.length ? `\n\nЭта тема опирается на: ${top.prereq.map((p) => TOPIC_BY_ID[p]?.ru).join(', ')}.` : ''}${example ? `\n\nТипичная задача: _${example.stem.ru}_` : ''}`,
        kk: `**${top.kk}** (${top.grade} сынып)\n\n${top.summary?.kk || ''}\n\nОсы тақырып бойынша деңгейің — **${Math.round(pL * 100)}%**.${top.prereq.length ? `\n\nБұл тақырып мыналарға сүйенеді: ${top.prereq.map((p) => TOPIC_BY_ID[p]?.kk).join(', ')}.` : ''}`,
        en: `**${top.en || top.ru}** (grade ${top.grade})\n\n${top.summary?.ru || ''}\n\nYour level: **${Math.round(pL * 100)}%**.`,
      }),
      chips: [{ label: pick(lang, { ru: 'Практиковать', kk: 'Жаттығу', en: 'Practice' }), action: `learn:${top.id}` }],
      refs: hits.map((h) => h.topic.id),
    };
  }

  return {
    socratic: false,
    text: pick(lang, {
      ru: 'Я работаю по школьной программе Казахстана: математика 7–11 и физика 9 класс. Спроси про конкретную тему — например «объясни дискриминант» или «с чего начать подготовку к ЕНТ».',
      kk: 'Мен Қазақстанның мектеп бағдарламасымен жұмыс істеймін: математика 7–11 және физика 9 сынып. Нақты тақырып сұра.',
      en: 'I work with the Kazakhstani school curriculum: maths 7–11 and physics 9. Ask about a specific topic.',
    }),
    chips: [],
    refs: [],
  };
}

const pick = (lang, map) => map[lang] || map.ru;

/**
 * Облачный режим: тот же контекст уходит на наш эндпоинт /api/tutor.
 *
 * Ключ Gemini живёт в переменных окружения Vercel и в браузер не попадает —
 * поэтому ученику больше нечего вводить и нечего терять. Раньше здесь был
 * прямой вызов Claude API с ключом из localStorage: для публичного сайта это
 * значило, что ключ видит любой, кто откроет devtools.
 *
 * Функция бросает исключение при любой неудаче — вызывающий код молча
 * возвращается к разбору на устройстве. Это и есть страховка оффлайна:
 * нет сети, нет ключа на сервере, упал провайдер — урок продолжается.
 */
export async function answerWithServer(text, profile, ctx, lang, history = []) {
  const hits = retrieve(text, lang);
  const L = (obj) => (obj && (obj[lang] || obj.ru)) || '';

  /* Модели отдаём не весь учебник, а два среза: темы по смыслу вопроса и
     самые слабые темы ученика. Первое отвечает на «о чём спросили», второе —
     на «что с этим учеником не так». Без второго совет получается общим. */
  const weakest = TOPICS
    .filter((tp) => (profile.subjects || ['math']).includes(tp.subject))
    .map((tp) => ({ tp, pL: masteryOf(profile, tp.id) }))
    .sort((a, b) => a.pL - b.pL)
    .slice(0, 5);

  const seen = new Set();
  const topics = [...hits.map((h) => h.topic), ...weakest.map((w) => w.tp)]
    .filter((tp) => !seen.has(tp.id) && seen.add(tp.id))
    .map((tp) => ({ id: tp.id, title: L(tp), mastery: masteryOf(profile, tp.id) }));

  /* Срок ожидания на стороне клиента.
     Продукт обещает работать на плохой связи, а значит не имеет права
     молча ждать облако сколько угодно: разбор на устройстве уже посчитан и
     готов. Двенадцать секунд — это чуть больше серверного срока (10 с),
     чтобы в обычном случае ответ приходил с понятной причиной отказа, а не
     обрывался здесь. */
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);

  const res = await fetch('/api/tutor', {
    method: 'POST',
    signal: ctrl.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: text,
      lang,
      history: history.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      profile: {
        theta: profile.theta ?? 0,
        grade: profile.grade,
        goal: profile.goal,
        attempts: profile.attempts ?? 0,
      },
      topics,
      currentItem: ctx.item ? L(ctx.item.stem) : null,
    }),
  });

  clearTimeout(timer);

  if (!res.ok) throw new Error(`tutor ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.text !== 'string') throw new Error('tutor: пустой ответ');

  return {
    socratic: data.intent === 'refuse_answer',
    text: data.text,
    chips: (data.actions || []).map(toChip).filter(Boolean),
    refs: hits.map((h) => h.topic.id),
    source: 'cloud',
  };
}

/**
 * Кнопка из структурированного действия модели.
 *
 * Схема ответа заставляет модель называть следующий шаг типом, а не прятать
 * его в текст, — поэтому UI рисует настоящую кнопку и никогда не парсит прозу.
 * Несуществующий topicId отбрасываем: модель может его выдумать, а ссылка
 * в никуда хуже отсутствия кнопки.
 */
function toChip(a) {
  if (!a || typeof a.label !== 'string' || !a.label.trim()) return null;
  const label = a.label.slice(0, 40);
  if (a.type === 'learn') {
    return TOPIC_BY_ID[a.topicId] ? { label, action: `learn:${a.topicId}` } : null;
  }
  if (a.type === 'graph') return { label, action: 'graph' };
  if (a.type === 'plan') return { label, action: 'plan' };
  if (a.type === 'hint') return { label, action: 'hint' };
  if (a.type === 'easier') return { label, action: 'easier' };
  return null;
}

/**
 * Разбор ответа ученика на задание — «обратная связь от AI».
 * Мы не просто пишем «неверно», а называем вероятную ошибку мышления
 * (misconception) и показываем разбор.
 */
export function feedbackFor(item, chosenIndex, lang = 'ru') {
  const correct = chosenIndex === item.answer;
  if (correct) {
    return {
      correct,
      title: pick(lang, { ru: 'Верно', kk: 'Дұрыс', en: 'Correct' }),
      body: item.explain[lang] || item.explain.ru,
    };
  }
  return {
    correct,
    title: pick(lang, { ru: 'Пока не то', kk: 'Әзірге дұрыс емес', en: 'Not quite' }),
    misconception: item.misconception,
    body: item.explain[lang] || item.explain.ru,
  };
}
