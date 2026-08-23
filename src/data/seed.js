/**
 * Демо-данные класса для панели учителя.
 *
 * Данные генерируются детерминированно (собственный PRNG с фиксированным
 * зерном), поэтому во время демонстрации жюри картина всегда одна и та же,
 * но при этом она статистически правдоподобна: у каждого ученика свой
 * профиль пробелов, а не случайный шум.
 */

import { TOPICS } from './curriculum.js';

const NAMES = [
  'Айгерім С.', 'Данияр Қ.', 'Мадина Ж.', 'Ерасыл Т.', 'Аружан Б.',
  'Нұрсұлтан А.', 'Камила И.', 'Алихан М.', 'Дильназ О.', 'Темирлан Р.',
  'Сабина Н.', 'Ислам Ғ.', 'Жанель У.', 'Арман Д.', 'Аяулым Х.',
  'Бекзат Е.', 'Инжу П.', 'Мирас В.', 'Ділдә Ш.', 'Алишер Ж.',
];

const REGIONS = ['reg.turkestan', 'reg.astana', 'reg.kyzylorda', 'reg.aktobe'];

/** Детерминированный генератор (mulberry32). */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedClass() {
  const rand = rng(20260817);
  const students = NAMES.map((name, i) => {
    // Скрытая «истинная способность» ученика — из неё выводим наблюдаемые данные.
    const ability = -1.4 + rand() * 2.8;
    const diligence = 0.3 + rand() * 0.7;
    const mastery = {};
    TOPICS.forEach((t) => {
      // Вероятность освоения падает с ростом сложности темы относительно способности.
      const p = 1 / (1 + Math.exp(-(ability - t.b) * 1.6));
      const noise = (rand() - 0.5) * 0.22;
      const attempts = Math.round(diligence * (2 + rand() * 6));
      mastery[t.id] = {
        pL: Math.min(0.97, Math.max(0.05, p + noise)),
        attempts,
        correct: Math.round(attempts * Math.min(1, p + noise / 2)),
        lastSeen: Date.now() - Math.round(rand() * 12) * 86_400_000,
        streak: 0,
      };
    });
    return {
      id: `s${i + 1}`,
      name,
      grade: 9,
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
      theta: Number(ability.toFixed(2)),
      diligence: Number(diligence.toFixed(2)),
      xp: Math.round(120 + rand() * 900),
      streakDays: Math.round(rand() * 9),
      // Активность за последние 14 дней — для мини-графика вовлечённости.
      activity: Array.from({ length: 14 }, () => (rand() < diligence ? Math.round(rand() * 8) : 0)),
      mastery,
      subjects: ['math', 'physics'],
      goal: 'ent',
    };
  });

  return {
    id: 'k9b',
    // Ключи, а не строки: демо-класс тоже должен говорить на языке интерфейса.
    nameKey: 'klass.name',
    schoolKey: 'klass.school',
    teacher: 'Гүлнара Әбдіқызы',
    students,
    customModules: [],
  };
}
