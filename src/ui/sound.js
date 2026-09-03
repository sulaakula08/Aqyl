/**
 * Звуковые сигналы.
 *
 * Ни одного аудиофайла: всё синтезируется осцилляторами Web Audio прямо на
 * устройстве. Причина та же, что и у остальной архитектуры — приложение
 * должно ставиться в кэш целиком и открываться офлайн, а три коротких mp3 в
 * приличном качестве весят больше, чем весь интерфейс.
 *
 * По умолчанию звук ВЫКЛЮЧЕН. Это не осторожность, а условие задачи:
 * платформу открывают в классе, где два десятка устройств делают это
 * одновременно. Включает его ученик сам, и настройка переживает перезагрузку.
 *
 * Мотивы намеренно крошечные (меньше полусекунды) и не спорят друг с другом:
 * верно — восходящая терция, ошибка — один мягкий низкий тон без диссонанса
 * (ошибка не должна звучать как проигрыш), блок закрыт — короткое трезвучие.
 */

import { getSettings, update } from '../state.js';

let ctx = null;

/**
 * Контекст создаётся при первом же звуке, а не при загрузке.
 *
 * Браузер всё равно не даст запустить звук до первого действия ученика, а
 * созданный заранее AudioContext висит в состоянии suspended и на части
 * Android продолжает удерживать аудиоустройство.
 */
function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { return null; }
  return ctx;
}

export const soundOn = () => getSettings().sound === true;

export function toggleSound(on) {
  update((s) => { s.settings.sound = on === undefined ? !s.settings.sound : Boolean(on); });
  if (soundOn()) { audio()?.resume?.(); note(880, 0.06, 0.09); }
  return soundOn();
}

/**
 * Одна нота. Гладкая атака и затухание обязательны: прямоугольный конверт
 * даёт щелчок на дешёвых динамиках, а щелчок в наушниках ребёнка — это
 * уже не «звук интерфейса», а неприятность.
 */
function note(freq, dur = 0.12, gain = 0.07, delay = 0, type = 'sine') {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const CUES = {
  // Восходящая большая терция: короткий сигнал «засчитано».
  correct: () => { note(587.33, 0.11, 0.06); note(739.99, 0.16, 0.06, 0.07); },
  // Один тон вниз, тихо и мягко. Ошибка — это не проигрыш.
  wrong: () => { note(233.08, 0.2, 0.045, 0, 'triangle'); },
  // Трезвучие: единственный «праздничный» звук во всём приложении.
  celebrate: () => {
    note(523.25, 0.12, 0.055);
    note(659.25, 0.12, 0.055, 0.09);
    note(783.99, 0.26, 0.06, 0.18);
  },
  unlock: () => { note(659.25, 0.1, 0.05); note(987.77, 0.2, 0.05, 0.08); },
  hint: () => { note(440, 0.09, 0.04, 0, 'triangle'); },
};

/** Сыграть сигнал. Молча ничего не делает, пока звук выключен. */
export function cue(name) {
  if (!soundOn()) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume?.();
  CUES[name]?.();
}
