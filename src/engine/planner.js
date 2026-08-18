/**
 * Конструктор индивидуального плана подготовки.
 *
 * На вход: цель ученика, дата экзамена и текущая карта освоения.
 * На выходе: недельный роадмап, где темы расставлены в топологическом
 * порядке графа знаний (предпосылки идут раньше следствий), а нагрузка
 * распределена так, чтобы уложиться в оставшееся время.
 */

import { TOPICS, TOPIC_BY_ID } from '../data/curriculum.js';
import { masteryOf } from './recommender.js';

/** Топологическая сортировка подграфа выбранных тем. */
function topoSort(topicIds) {
  const set = new Set(topicIds);
  const visited = new Set();
  const out = [];
  const visit = (id) => {
    if (visited.has(id) || !set.has(id)) return;
    visited.add(id);
    (TOPIC_BY_ID[id]?.prereq || []).forEach(visit);
    out.push(id);
  };
  topicIds.forEach(visit);
  return out;
}

/**
 * @param {object} profile профиль ученика
 * @param {number} weeklyHours сколько часов в неделю ученик готов заниматься
 */
export function buildRoadmap(profile, weeklyHours = 5) {
  const subjects = profile.subjects?.length ? profile.subjects : ['math'];
  const relevant = TOPICS
    .filter((t) => subjects.includes(t.subject))
    .filter((t) => (profile.goal === 'ahead' ? true : t.grade <= profile.grade + 1))
    .map((t) => ({ ...t, pL: masteryOf(profile, t.id) }))
    .filter((t) => t.pL < 0.85);

  const ordered = topoSort(relevant.map((t) => t.id));

  // Часы на тему: чем ниже освоение и выше сложность — тем больше времени.
  const withCost = ordered.map((id) => {
    const t = TOPIC_BY_ID[id];
    const pL = masteryOf(profile, id);
    const hours = Math.max(1, Math.round((1 - pL) * 4 + Math.max(0, t.b) * 1.5));
    return { id, hours, pL, topic: t };
  });

  const totalHours = withCost.reduce((s, x) => s + x.hours, 0);
  const weeksAvailable = weeksUntil(profile.examDate);

  const weeks = pack(withCost, weeklyHours);
  // Реальный срок — число собранных недель, а не деление часов на норму:
  // тему нельзя разрезать между неделями, поэтому упаковка даёт больше недель.
  const weeksNeeded = weeks.length;

  return {
    weeks,
    totalHours,
    weeksNeeded,
    weeksAvailable,
    weeklyHours,
    // Успевает ли ученик к экзамену при текущем темпе.
    onTrack: weeksAvailable === null ? null : weeksNeeded <= weeksAvailable,
    // Сколько часов в неделю реально нужно, чтобы успеть: ищем минимальную
    // норму, при которой упаковка укладывается в оставшиеся недели.
    requiredWeeklyHours: weeksAvailable ? minWeeklyHours(withCost, weeksAvailable) : null,
  };
}

/** Раскладка тем по неделям с соблюдением порядка (жадная упаковка). */
function pack(withCost, weeklyHours) {
  const weeks = [];
  let bucket = { hours: 0, topics: [] };
  withCost.forEach((x) => {
    if (bucket.hours + x.hours > weeklyHours && bucket.topics.length) {
      weeks.push(bucket);
      bucket = { hours: 0, topics: [] };
    }
    bucket.hours += x.hours;
    bucket.topics.push(x);
  });
  if (bucket.topics.length) weeks.push(bucket);
  return weeks;
}

function minWeeklyHours(withCost, weeksAvailable) {
  const max = withCost.reduce((s, x) => s + x.hours, 0) || 1;
  for (let h = 1; h <= max; h++) {
    if (pack(withCost, h).length <= weeksAvailable) return h;
  }
  return max;
}

export function weeksUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.ceil(diff / (7 * 86_400_000)));
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
