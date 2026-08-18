/**
 * Хранилище состояния AQYL.
 *
 * Всё живёт в localStorage: приложение полностью работает офлайн и не требует
 * бэкенда для демонстрации. Схема данных при этом уже спроектирована под
 * будущую БД (таблицы users, mastery, attempts, classes), поэтому переезд
 * на Supabase/Postgres — это замена одного модуля-адаптера.
 */

import { BKT, bktUpdate, eloUpdate, nextReviewDays } from './engine/mastery.js';
import { seedClass } from './data/seed.js';

const KEY = 'aqyl.state.v1';

const emptyProfile = () => ({
  id: 'me',
  name: '',
  school: '',
  region: 'Туркестанская область',
  grade: 9,
  subjects: ['math'],
  goal: 'ent',
  examDate: '',
  lang: 'ru',
  theta: 0,          // способность в шкале Elo/логитов
  attempts: 0,
  xp: 0,
  streakDays: 1,
  lastActive: null,
  diagnosticDone: false,
  mastery: {},       // topicId -> { pL, attempts, correct, lastSeen, streak }
  history: [],       // журнал попыток — источник правды для аналитики
  badges: [],
});

const defaultState = () => ({
  profile: emptyProfile(),
  klass: seedClass(),
  settings: { lang: 'ru', tts: true, apiKey: '', cloudAI: false, reducedMotion: false },
  ui: { onboarded: false },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...parsed.profile },
      settings: { ...base.settings, ...parsed.settings },
      klass: parsed.klass?.students?.length ? parsed.klass : base.klass,
    };
  } catch {
    return defaultState();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('AQYL: не удалось сохранить состояние', e);
  }
}

export const getState = () => state;
export const getProfile = () => state.profile;
export const getSettings = () => state.settings;
export const lang = () => state.settings.lang;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  save();
  listeners.forEach((fn) => fn(state));
}

export function update(mutator) {
  mutator(state);
  emit();
}

export function setLang(l) {
  state.settings.lang = l;
  state.profile.lang = l;
  emit();
}

export function resetAll() {
  state = defaultState();
  emit();
}

/** Полный сброс прогресса с сохранением профиля — удобно для повторного демо. */
export function resetProgress() {
  const { name, school, region, grade, subjects, goal, examDate } = state.profile;
  state.profile = { ...emptyProfile(), name, school, region, grade, subjects, goal, examDate };
  state.klass = seedClass();
  emit();
}

/**
 * Регистрация попытки — центральная точка обучения системы.
 * Здесь одновременно обновляются: BKT по теме, Elo ученика, XP, стрик и журнал.
 */
export function recordAttempt({ item, chosen, correct, hintsUsed = 0, ms = 0 }) {
  const p = state.profile;
  const topicId = item.topic;
  const rec = p.mastery[topicId] || {
    pL: BKT.p_init, attempts: 0, correct: 0, lastSeen: null, streak: 0,
  };

  rec.pL = bktUpdate(rec.pL, correct);
  rec.attempts += 1;
  rec.correct += correct ? 1 : 0;
  rec.streak = correct ? rec.streak + 1 : 0;
  rec.lastSeen = Date.now();
  rec.nextReviewDays = nextReviewDays(rec.pL, rec.streak);
  p.mastery[topicId] = rec;

  const { theta } = eloUpdate(p.theta, item.b, correct, p.attempts);
  p.theta = theta;
  p.attempts += 1;

  // XP: за верный ответ, со скидкой за подсказки и бонусом за сложность.
  const gained = correct ? Math.max(4, Math.round((10 + item.b * 4) * (1 - 0.2 * hintsUsed))) : 2;
  p.xp += gained;

  p.history.push({
    itemId: item.id, topicId, correct, hintsUsed, ms, ts: Date.now(), b: item.b, theta,
  });
  if (p.history.length > 500) p.history.splice(0, p.history.length - 500);

  bumpStreak(p);
  checkBadges(p);
  emit();
  return { gained, pL: rec.pL, theta };
}

function bumpStreak(p) {
  const today = new Date().toDateString();
  if (p.lastActive !== today) {
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    p.streakDays = p.lastActive === yesterday ? p.streakDays + 1 : 1;
    p.lastActive = today;
  }
}

const BADGES = [
  { id: 'first', ru: 'Первый шаг', kk: 'Алғашқы қадам', en: 'First step', icon: 'sprout', test: (p) => p.attempts >= 1 },
  { id: 'ten', ru: 'Десятка', kk: 'Ондық', en: 'Ten solved', icon: 'stack', test: (p) => p.attempts >= 10 },
  { id: 'mastery', ru: 'Тема освоена', kk: 'Тақырып игерілді', en: 'Topic mastered', icon: 'mountain', test: (p) => Object.values(p.mastery).some((m) => m.pL >= 0.85) },
  { id: 'streak3', ru: 'Серия из 3 дней', kk: '3 күндік серия', en: '3-day streak', icon: 'flame', test: (p) => p.streakDays >= 3 },
  { id: 'nohint', ru: 'Без подсказок', kk: 'Нұсқаусыз', en: 'No hints', icon: 'target', test: (p) => p.history.filter((h) => h.correct && !h.hintsUsed).length >= 5 },
  { id: 'climber', ru: 'Уровень выше нуля', kk: 'Деңгей нөлден жоғары', en: 'Above baseline', icon: 'trend', test: (p) => p.theta > 0.5 },
];

export const ALL_BADGES = BADGES;

function checkBadges(p) {
  BADGES.forEach((b) => {
    if (!p.badges.includes(b.id) && b.test(p)) p.badges.push(b.id);
  });
}

/** Добавление собственного модуля учителем — сохраняется в состоянии школы. */
export function addTeacherModule(mod) {
  state.klass.customModules = state.klass.customModules || [];
  state.klass.customModules.unshift({ ...mod, id: `custom.${Date.now()}`, createdAt: Date.now() });
  emit();
}
