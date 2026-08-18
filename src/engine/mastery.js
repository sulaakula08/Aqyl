/**
 * Модель освоения знаний AQYL.
 *
 * Мы намеренно не используем «чёрный ящик». Оценка ученика складывается
 * из двух прозрачных, проверяемых временем моделей:
 *
 *  1. Bayesian Knowledge Tracing (Corbett & Anderson, 1995) — вероятность
 *     P(L) того, что тема действительно освоена. Учитывает, что ученик
 *     может угадать (guess) и ошибиться по невнимательности (slip).
 *
 *  2. Elo-рейтинг (адаптация из шахмат, применяется в Khan Academy и Duolingo) —
 *     общая способность ученика theta в той же шкале, что и сложность заданий b.
 *     Он позволяет подобрать задание в «зоне ближайшего развития» Выготского.
 *
 * Обе модели дают числа, которые можно показать ученику и объяснить жюри.
 */

/** Параметры BKT. Подобраны как разумные значения по умолчанию для школьной математики. */
export const BKT = {
  p_init: 0.25,   // априорная вероятность, что тема уже освоена
  p_transit: 0.18, // вероятность «выучить» тему за одну попытку
  p_slip: 0.10,   // знает, но ошибся
  p_guess: 0.22,  // не знает, но угадал (≈ 1/4 для 4 вариантов + отсев)
};

/**
 * Обновление вероятности освоения после одной попытки.
 * @param {number} pL текущая P(освоено)
 * @param {boolean} correct правильный ли ответ
 * @returns {number} обновлённая P(освоено)
 */
export function bktUpdate(pL, correct) {
  const { p_slip: s, p_guess: g, p_transit: t } = BKT;
  // Шаг 1: апостериорная вероятность по формуле Байеса
  const posterior = correct
    ? (pL * (1 - s)) / (pL * (1 - s) + (1 - pL) * g)
    : (pL * s) / (pL * s + (1 - pL) * (1 - g));
  // Шаг 2: вероятность перехода «не знал → выучил» в момент решения
  return clamp01(posterior + (1 - posterior) * t);
}

/**
 * Обновление Elo-рейтингов ученика и задания.
 * K-фактор уменьшается с опытом: первые ответы двигают оценку сильно,
 * поздние — уточняют её.
 */
export function eloUpdate(theta, b, correct, attempts) {
  const expected = 1 / (1 + Math.pow(10, (b - theta) / 1.2));
  const K = 0.6 / (1 + 0.06 * attempts);
  return {
    theta: clampRange(theta + K * ((correct ? 1 : 0) - expected), -3, 3),
    expected,
  };
}

/**
 * Забывание. Кривая Эббингауза: без повторения уверенность в теме падает
 * экспоненциально. Половина «уверенности» теряется примерно за 14 дней.
 */
export function applyDecay(pL, lastSeenTs, now = Date.now()) {
  if (!lastSeenTs) return pL;
  const days = (now - lastSeenTs) / 86_400_000;
  if (days <= 0) return pL;
  const retention = Math.pow(0.5, days / 14);
  // Забывание не опускает знание ниже априорного уровня.
  return clamp01(BKT.p_init + (pL - BKT.p_init) * retention);
}

/**
 * Интервальное повторение (упрощённый SM-2). Чем увереннее освоена тема,
 * тем реже её нужно повторять.
 */
export function nextReviewDays(pL, streak = 0) {
  if (pL < 0.4) return 1;
  const base = [1, 3, 7, 16, 35][Math.min(streak, 4)];
  return Math.max(1, Math.round(base * (0.5 + pL)));
}

/** Уровень владения темой в человеческих словах. */
export function masteryBand(pL) {
  if (pL >= 0.85) return 'mastered';
  if (pL >= 0.6) return 'strong';
  if (pL >= 0.35) return 'developing';
  return 'gap';
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const clampRange = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
