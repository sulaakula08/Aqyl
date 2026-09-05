/**
 * Речь: клюв, синхронизированный с озвучкой.
 *
 * Web Speech API не отдаёт фонемы — только событие `boundary` на границе
 * слова. Настоящей артикуляции из этого не собрать, и гнаться за ней не
 * нужно: на размере персонажа в 120 пикселей зритель различает ровно две
 * формы — клюв открыт и клюв закрыт. Важна не точность, а совпадение по
 * времени: рот, который шевелится в такт словам, читается как говорящий,
 * даже если форма приблизительная.
 *
 * Амплитуда берётся из числа гласных в слове: «а» шире, чем «в». Это
 * дешёвая эвристика, но она даёт разную открытость на разных словах —
 * а именно однообразие выдаёт механическую анимацию.
 *
 * Safari не присылает `boundary` для многих голосов, и в этом случае клюв
 * просто работает ровным циклом на оценённую длительность фразы. Отсутствие
 * события не должно оставлять персонажа с застывшим лицом посреди ответа.
 */

import { play, isCalm, T, SOFT } from './anim.js';

const VOWELS = /[аеёиоуыэюяәөұүіaeiouy]/gi;

/** Оценка длительности слова: короткие слова произносятся быстрее длинных. */
const wordMs = (word) => Math.min(520, 90 + word.length * 42);

function openBeak(parts, amount, ms) {
  if (!parts.beakBottom || isCalm()) return;
  play(parts.beakBottom, [
    T('rotate(0deg)'),
    T(`rotate(${amount.toFixed(1)}deg)`),
    T('rotate(0deg)'),
  ], { duration: ms, easing: SOFT });
}

/**
 * Произнести текст, шевеля клювом.
 *
 * @param {object} parts    части оснастки
 * @param {string} text     что говорим
 * @param {object} opts     { locale, tts, onEnd }
 * @returns {Function}      остановка (и озвучки, и движения клюва)
 */
export function say(parts, text, opts = {}) {
  const { locale = 'ru-RU', tts = true, onEnd, onWord } = opts;
  const clean = String(text || '').trim();
  if (!clean) return () => {};

  let stopped = false;
  let fallbackTimer = null;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(fallbackTimer);
    if (parts.beakBottom) play(parts.beakBottom, [T('rotate(0deg)')], { duration: 160, fill: 'forwards' });
    onEnd?.();
  };

  /* Беззвучная речь — не запасной путь, а основной.
     Озвучка в классе неуместна, поэтому обычно персонаж «говорит» молча:
     клюв работает, а слова наружу отдаются по одному через onWord — их
     подхватывает экран репетитора и открывает текст ровно в том темпе, в
     котором персонаж его произносит. Ответ не вываливается стеной, а
     появляется так, будто его действительно кто-то сейчас говорит.
     Темп чтения быстрее темпа речи: слово за 38 мс читается, а клюв
     открывается на каждом третьем — иначе он тарахтит. */
  const words = clean.split(/\s+/).filter(Boolean);

  const talkLoop = () => {
    let i = 0;
    const tick = () => {
      if (stopped) return;
      if (i >= words.length) return finish();
      const w = words[i];
      if (i % 3 === 0) openBeak(parts, 11 + Math.min(4, (w.match(VOWELS) || []).length) * 4, 230);
      onWord?.(i, w);
      i += 1;
      fallbackTimer = setTimeout(tick, Math.max(34, Math.min(120, w.length * 7)));
    };
    tick();
  };

  if (!tts || !('speechSynthesis' in window)) {
    talkLoop();
    return finish;
  }

  let spoke = false;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = locale;
  u.rate = 0.95;

  u.onboundary = (e) => {
    if (stopped) return;
    spoke = true;
    if (e.name && e.name !== 'word') return;
    const rest = clean.slice(e.charIndex);
    const word = (rest.match(/^\S+/) || [''])[0];
    const vowels = (word.match(VOWELS) || []).length;
    openBeak(parts, 10 + Math.min(4, vowels) * 5, wordMs(word));
    // Индекс слова — по числу пробелов слева: так текст на экране открывается
    // ровно тем словом, которое голос произносит прямо сейчас.
    onWord?.(clean.slice(0, e.charIndex).split(/\s+/).filter(Boolean).length, word);
  };
  u.onend = finish;
  u.onerror = finish;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);

  /* Если через полсекунды не пришло ни одного `boundary`, считаем, что
     голос их не присылает, и переключаемся на ровный цикл. Проверка по
     факту, а не по названию браузера: список исключений устаревает. */
  setTimeout(() => { if (!spoke && !stopped) talkLoop(); }, 500);

  return () => {
    try { window.speechSynthesis.cancel(); } catch { /* уже остановлено */ }
    finish();
  };
}
