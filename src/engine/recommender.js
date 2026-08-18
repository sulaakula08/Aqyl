/**
 * Движок рекомендаций AQYL — «объяснимый ИИ» для обучения.
 *
 * Отличие от обычной ленты рекомендаций: мы не просто ранжируем темы,
 * а спускаемся по графу предпосылок и находим ПЕРВОПРИЧИНУ ошибки.
 * Если ученик валит квадратные уравнения, но проблема на самом деле
 * в формулах сокращённого умножения — система скажет об этом прямо
 * и отправит его на два уровня ниже, а не заставит решать то же самое.
 */

import { TOPICS, TOPIC_BY_ID, ITEMS_BY_TOPIC, UNLOCKS } from '../data/curriculum.js';
import { applyDecay, masteryBand, nextReviewDays, BKT, clamp01 } from './mastery.js';

/**
 * Прямое свидетельство: ученик реально решал задания по теме.
 * @returns {number|null} P(освоено) или null, если данных нет.
 */
export function evidenceOf(profile, topicId) {
  const rec = profile.mastery[topicId];
  if (!rec || !rec.attempts) return null;
  return applyDecay(rec.pL, rec.lastSeen);
}

export const hasEvidence = (profile, topicId) => evidenceOf(profile, topicId) !== null;

/**
 * Оценка темы, по которой ученик ещё не решал заданий.
 * Мы не ставим «по умолчанию 25%», а делаем содержательный вывод:
 *
 *  1. Априор из теории тестирования (IRT): вероятность справиться с темой
 *     сложности b при способности theta.
 *  2. Потолок по графу: тема не может быть освоена заметно лучше, чем
 *     самая слабая из её предпосылок.
 *  3. Пол по графу: если следствие темы уже освоено, значит и сама тема
 *     фактически освоена — иначе следствие не далось бы.
 *
 * Берутся только прямые соседи, поэтому рекурсии здесь нет.
 */
function inferFromGraph(profile, topicId) {
  const t = TOPIC_BY_ID[topicId];
  if (!t) return BKT.p_init;

  let est = successChance(profile.theta ?? 0, t.b) * 0.8 + BKT.p_init * 0.2;

  const prereqs = t.prereq.map((p) => evidenceOf(profile, p)).filter((v) => v !== null);
  if (prereqs.length) est = Math.min(est, Math.min(...prereqs) + 0.2);

  const successors = (UNLOCKS[topicId] || []).map((s) => evidenceOf(profile, s)).filter((v) => v !== null);
  if (successors.length) est = Math.max(est, Math.max(...successors) * 0.9);

  return clamp01(est);
}

/** Актуальная P(освоено): свидетельство, если оно есть, иначе вывод по графу. */
export function masteryOf(profile, topicId) {
  const direct = evidenceOf(profile, topicId);
  return direct !== null ? direct : inferFromGraph(profile, topicId);
}

/** Готовность темы: насколько освоены все её предпосылки (0…1). */
export function readinessOf(profile, topicId) {
  const t = TOPIC_BY_ID[topicId];
  if (!t || t.prereq.length === 0) return 1;
  return t.prereq.reduce((min, p) => Math.min(min, masteryOf(profile, p)), 1);
}

/**
 * Шаг вниз по графу: какая предпосылка объясняет провал текущей темы.
 *
 * Спускаемся только если предпосылка действительно слабая И не сильнее
 * самой темы. Без второго условия система «проваливалась» бы до корня графа
 * всегда — даже когда база в порядке, а проблема именно в текущей теме.
 * Приоритет отдаём предпосылкам, по которым есть реальные ответы ученика.
 */
function weakestPrereq(profile, topicId, guard = new Set()) {
  const t = TOPIC_BY_ID[topicId];
  if (!t) return null;
  const own = masteryOf(profile, topicId);
  return t.prereq
    .filter((p) => !guard.has(p))
    .map((p) => ({ id: p, pL: masteryOf(profile, p), proven: hasEvidence(profile, p) }))
    .filter((p) => p.pL < 0.55 && p.pL <= own + 0.03)
    .sort((a, b) => (b.proven - a.proven) || (a.pL - b.pL))[0] || null;
}

/** Первопричина: самая глубокая предпосылка, которая объясняет пробел. */
export function rootCause(profile, topicId) {
  const chain = causeChain(profile, topicId);
  return chain[0];
}

/** Полная цепочка от первопричины к целевой теме — «маршрут восстановления». */
export function causeChain(profile, topicId) {
  const chain = [topicId];
  const guard = new Set([topicId]);
  let cur = topicId;
  for (let i = 0; i < 6; i++) {
    const weak = weakestPrereq(profile, cur, guard);
    if (!weak) break;
    chain.unshift(weak.id);
    guard.add(weak.id);
    cur = weak.id;
  }
  return chain;
}

/**
 * Приоритет темы. Складывается из четырёх понятных слагаемых —
 * каждое из них мы показываем ученику как причину рекомендации.
 */
export function scoreTopic(profile, topicId) {
  const t = TOPIC_BY_ID[topicId];
  const pL = masteryOf(profile, topicId);
  const readiness = readinessOf(profile, topicId);
  const reasons = [];

  // 1. Пробел в знаниях — главный сигнал.
  const gap = (1 - pL) * 40;
  if (pL < 0.4) reasons.push({ key: 'gap', weight: gap });

  // 2. Готовность: нет смысла давать тему, к которой ученик не подготовлен.
  const ready = readiness * 25;
  if (readiness < 0.5) reasons.push({ key: 'blocked', weight: -20 });

  // 3. Связь с целью: тема ведёт к экзамену / соответствует классу.
  const goalFit = fitsGoal(profile, t) ? 18 : 0;
  if (goalFit) reasons.push({ key: 'goal', weight: goalFit });

  // 4. Ценность разблокировки: сколько новых тем откроется.
  const leverage = (UNLOCKS[topicId] || []).length * 4;
  if (leverage >= 8) reasons.push({ key: 'leverage', weight: leverage });

  // 5. Пора повторить (интервальное повторение).
  const rec = profile.mastery[topicId];
  let review = 0;
  if (rec && rec.lastSeen && pL >= 0.6) {
    const dueIn = nextReviewDays(rec.pL, rec.streak || 0) - (Date.now() - rec.lastSeen) / 86_400_000;
    if (dueIn <= 0) {
      review = 22;
      reasons.push({ key: 'review', weight: review });
    }
  }

  const gradeFit = Math.max(0, 10 - Math.abs(t.grade - profile.grade) * 5);

  return {
    topicId,
    score: gap + ready + goalFit + leverage + review + gradeFit + (readiness < 0.5 ? -20 : 0),
    pL,
    readiness,
    reasons: reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    band: masteryBand(pL),
  };
}

function fitsGoal(profile, topic) {
  if (profile.goal === 'ent') return topic.grade <= 11;
  if (profile.goal === 'olympiad') return topic.b >= 0.4;
  if (profile.goal === 'ahead') return topic.grade >= profile.grade;
  return topic.grade <= profile.grade;
}

/** Топ-N рекомендаций по выбранным предметам. */
export function recommend(profile, limit = 4) {
  const subjects = profile.subjects?.length ? profile.subjects : ['math'];
  return TOPICS
    .filter((t) => subjects.includes(t.subject))
    .map((t) => scoreTopic(profile, t.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({ ...s, root: rootCause(profile, s.topicId), chain: causeChain(profile, s.topicId) }));
}

/** Слабые места — то, что ученик видит в разделе «на что обратить внимание». */
export function weakSpots(profile, limit = 5) {
  const subjects = profile.subjects?.length ? profile.subjects : ['math'];
  return TOPICS
    .filter((t) => subjects.includes(t.subject))
    .map((t) => ({ topicId: t.id, pL: masteryOf(profile, t.id), attempts: profile.mastery[t.id]?.attempts || 0 }))
    .filter((x) => x.attempts > 0 && x.pL < 0.6)
    .sort((a, b) => a.pL - b.pL)
    .slice(0, limit);
}

/**
 * Подбор следующего задания внутри темы — зона ближайшего развития.
 * Целимся в задание, где вероятность успеха ученика ≈ 70 %:
 * достаточно сложно, чтобы учиться, достаточно посильно, чтобы не сдаться.
 */
export function pickItem(profile, topicId, excludeIds = []) {
  const pool = (ITEMS_BY_TOPIC[topicId] || []).filter((i) => !excludeIds.includes(i.id));
  if (!pool.length) return null;
  const theta = profile.theta ?? 0;
  const target = theta - 0.4; // b, при котором P(успех) ≈ 0.7
  return pool.reduce((best, item) =>
    Math.abs(item.b - target) < Math.abs(best.b - target) ? item : best
  );
}

/**
 * Адаптивная диагностика. Классический адаптивный тест: следующий вопрос
 * выбирается там, где ответ даст максимум информации о ученике,
 * то есть где предсказанная вероятность успеха ближе всего к 50 %.
 */
export function pickDiagnosticItem(profile, askedIds, subjects) {
  const theta = profile.theta ?? 0;
  const pool = TOPICS
    .filter((t) => subjects.includes(t.subject))
    .flatMap((t) => ITEMS_BY_TOPIC[t.id] || [])
    .filter((i) => !askedIds.includes(i.id));
  if (!pool.length) return null;

  const seenTopics = new Set(
    askedIds.map((id) => pool.length && id.split('.').slice(0, 2).join('.'))
  );
  return pool.reduce((best, item) => {
    const info = (t) => Math.abs(t.b - theta) + (seenTopics.has(t.topic) ? 0.75 : 0);
    return info(item) < info(best) ? item : best;
  });
}

/** Ожидаемая вероятность успеха — используется и в UI («ваш шанс справиться»). */
export function successChance(theta, b) {
  return 1 / (1 + Math.pow(10, (b - theta) / 1.2));
}
