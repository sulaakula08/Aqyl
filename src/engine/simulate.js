/**
 * Симулятор «что будет, если».
 *
 * Обычная рекомендация отвечает на вопрос «что тебе слабее всего». Это не тот
 * вопрос. Ученику перед экзаменом важно другое: «куда вложить следующие три
 * часа, чтобы получить больше всего». Ответы расходятся чаще, чем кажется:
 * самая слабая тема нередко висит на непройденной базе и стоит дорого, а
 * соседняя, чуть более сильная, разблокирует пять последующих за час.
 *
 * Поэтому здесь мы честно проигрываем контрфактику: берём профиль, мысленно
 * закрываем одну тему до уверенного уровня и пересчитываем последствия по
 * тому же графу и тем же моделям, что и всё остальное в продукте. Никаких
 * отдельных «магических» формул: если ученик не согласен с прогнозом, он
 * может проследить его до конкретных рёбер графа.
 *
 * Считается на устройстве за миллисекунды и работает без сети — как и
 * остальной движок.
 */

import { TOPICS, TOPIC_BY_ID, UNLOCKS } from '../data/curriculum.js';
import { masteryOf, readinessOf, successChance, causeChain } from './recommender.js';
import { clamp01 } from './mastery.js';

/** Уровень, который считаем «тема закрыта». Совпадает с порогом band=mastered. */
export const TARGET = 0.85;

/** Порог, ниже которого тема считается заблокированной отсутствующей базой. */
const READY_GATE = 0.5;

const subjectTopics = (subjects) =>
  TOPICS.filter((t) => (subjects && subjects.length ? subjects : ['math']).includes(t.subject));

/**
 * Готовность к экзамену, 0…1.
 *
 * Сознательно НЕ называем это баллом ЕНТ и не приводим к 140-балльной шкале:
 * у нас нет данных, чтобы такое отображение защитить, а выдуманная точность
 * — первое, что развалится на вопросах жюри. Это доля программы, которой
 * ученик владеет, взвешенная по вероятности справиться с заданием темы.
 */
export function readinessScore(profile, subjects) {
  const list = subjectTopics(subjects);
  if (!list.length) return 0;
  const sum = list.reduce((acc, t) => {
    const pL = masteryOf(profile, t.id);
    // Освоение темы и шанс решить её задание — разные вещи; берём обе.
    const chance = successChance(profile.theta ?? 0, t.b);
    return acc + (pL * 0.7 + chance * 0.3);
  }, 0);
  return clamp01(sum / list.length);
}

/**
 * Оценка часов на закрытие темы.
 *
 * Грубая, и мы это признаём: пока у нас нет логов реального прохождения,
 * честнее показать порядок величины, чем ложную точность до минут.
 * Базовые 40 минут на тему плюс надбавка за размер пробела и за сложность.
 */
export function hoursToClose(profile, topicId) {
  const t = TOPIC_BY_ID[topicId];
  if (!t) return 0;
  // Часы считаем по замаху ученика — он садится закрывать тему до конца,
  // независимо от того, пустит ли его туда база. Сколько он на самом деле
  // получит за эти часы, решает achievableFor() ниже.
  const gap = Math.max(0, TARGET - masteryOf(profile, topicId));
  const difficulty = 1 + Math.max(0, t.b + 1) * 0.35;
  const h = (0.7 + gap * 3.2) * difficulty;
  return Math.round(h * 2) / 2; // до получаса
}

/**
 * Потолок освоения темы при нынешней базе.
 *
 * Это не выдуманный штраф, а то же правило, по которому движок оценивает
 * непройденные темы (см. inferFromGraph и страницу «Как устроен ИИ»):
 * тема не может быть освоена заметно лучше своей слабейшей предпосылки.
 *
 * Без него симуляция врала в самую опасную сторону: она обещала, что можно
 * закрыть квадратные уравнения до 85%, не починив раскрытие скобок, — то
 * есть ровно то заблуждение, против которого построен весь продукт.
 */
export function achievableFor(profile, topicId, target = TARGET) {
  return Math.min(target, readinessOf(profile, topicId) + 0.2);
}

/** Профиль, в котором одна тема закрыта до уверенного уровня. */
function withTopicClosed(profile, topicId, target = TARGET) {
  const prev = profile.mastery?.[topicId] || {};
  return {
    ...profile,
    mastery: {
      ...(profile.mastery || {}),
      // attempts > 0 обязателен: иначе masteryOf сочтёт это отсутствием
      // свидетельства и вернётся к выводу по графу, проигнорировав симуляцию.
      [topicId]: { ...prev, pL: target, attempts: Math.max(1, prev.attempts || 0), correct: prev.correct || 1 },
    },
  };
}

/**
 * Что произойдёт, если закрыть одну тему.
 * @returns {{topicId, before, after, delta, unlocked, unlockedIds, hours, gainPerHour, chain}}
 */
export function simulateFix(profile, topicId, subjects, target = TARGET) {
  const achievable = achievableFor(profile, topicId, target);
  const before = readinessScore(profile, subjects);
  const next = withTopicClosed(profile, topicId, achievable);
  const after = readinessScore(next, subjects);

  // Разблокированной считаем тему, чья готовность перешла порог именно
  // из-за этого закрытия, а сама тема ещё не освоена — иначе «разблокировка»
  // была бы фиктивной.
  const unlockedIds = subjectTopics(subjects)
    .filter((t) => t.id !== topicId)
    .filter((t) => masteryOf(profile, t.id) < TARGET)
    .filter((t) => readinessOf(profile, t.id) < READY_GATE && readinessOf(next, t.id) >= READY_GATE)
    .map((t) => t.id);

  const hours = hoursToClose(profile, topicId);
  const delta = after - before;

  return {
    topicId,
    before,
    after,
    delta,
    achievable,
    // База не держит: часы уйдут, а тема всё равно упрётся в потолок.
    blocked: readinessOf(profile, topicId) < READY_GATE,
    readiness: readinessOf(profile, topicId),
    unlocked: unlockedIds.length,
    unlockedIds,
    hours,
    // Главное число: сколько готовности приносит один час именно здесь.
    gainPerHour: hours > 0 ? delta / hours : 0,
    directUnlocks: (UNLOCKS[topicId] || []).length,
  };
}

/**
 * Ранжирование вмешательств: куда вложить следующий час.
 *
 * Кандидатов ограничиваем темами, которые сейчас реально можно взять
 * (база под ними держит) и которые ещё не закрыты. Предлагать тему,
 * заблокированную собственной непройденной предпосылкой, было бы ровно той
 * ошибкой, против которой построен весь продукт.
 */
export function rankInterventions(profile, subjects, limit = 5) {
  return subjectTopics(subjects)
    .filter((t) => masteryOf(profile, t.id) < TARGET)
    .filter((t) => readinessOf(profile, t.id) >= READY_GATE)
    .map((t) => simulateFix(profile, t.id, subjects))
    .filter((s) => s.delta > 0.0001)
    .sort((a, b) => b.gainPerHour - a.gainPerHour)
    .slice(0, limit);
}

/**
 * Симптом против первопричины — то, ради чего экран и существует.
 *
 * Первая версия сравнивала «самую слабую тему» с «темой максимальной отдачи»
 * и почти всегда получала одно и то же: отдача на час сильно коррелирует
 * с размером пробела. Сравнение схлопывалось, и показывать было нечего.
 *
 * Настоящее противопоставление в продукте другое. Ученик садится долбить
 * тему, которую проваливает прямо сейчас, — симптом. Граф отправляет его
 * туда, где держит база. Разницу видно, только если честно посчитать, что
 * часы, вложенные в заблокированную тему, упираются в потолок из
 * achievableFor(): время потрачено, а освоение почти не сдвинулось.
 */
export function compareStrategies(profile, subjects) {
  // Симптом: самая слабая из тех тем, за которые ученик реально брался.
  const attempted = subjectTopics(subjects)
    .filter((t) => (profile.mastery?.[t.id]?.attempts || 0) > 0)
    .filter((t) => masteryOf(profile, t.id) < TARGET)
    .sort((a, b) => masteryOf(profile, a.id) - masteryOf(profile, b.id));

  const best = rankInterventions(profile, subjects, 1)[0];
  if (!best) return null;

  const symptomTopic = attempted[0];
  if (!symptomTopic) return { symptom: null, optimal: best, same: false, ratio: null };

  const symptom = simulateFix(profile, symptomTopic.id, subjects);
  const same = symptom.topicId === best.topicId;
  return {
    symptom,
    optimal: best,
    same,
    // Во сколько раз расчётный ход выгоднее интуитивного, по отдаче на час.
    ratio: symptom.gainPerHour > 0 ? best.gainPerHour / symptom.gainPerHour : null,
    chain: causeChain(profile, symptomTopic.id),
  };
}

/**
 * Накопительный план: закрываем темы жадно по отдаче и смотрим, куда
 * это выводит готовность. Каждый шаг пересчитывается на профиле, уже
 * учитывающем предыдущие, — поэтому эффекты не складываются наивно.
 */
export function projectPath(profile, subjects, steps = 4) {
  let cur = profile;
  const path = [];
  for (let i = 0; i < steps; i++) {
    const next = rankInterventions(cur, subjects, 1)[0];
    if (!next) break;
    path.push({
      topicId: next.topicId,
      hours: next.hours,
      after: next.after,
      unlocked: next.unlockedIds,
    });
    cur = withTopicClosed(cur, next.topicId);
  }
  return {
    start: readinessScore(profile, subjects),
    end: path.length ? path[path.length - 1].after : readinessScore(profile, subjects),
    totalHours: path.reduce((s, p) => s + p.hours, 0),
    steps: path,
  };
}
