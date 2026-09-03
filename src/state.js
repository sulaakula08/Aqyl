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
  region: 'reg.turkestan',
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
  /* cloudAI включён по умолчанию: ключ теперь на сервере, вводить нечего,
     а при любой неудаче ответ молча считается на устройстве. Ученик из села
     с обрывающейся связью ничего не настраивает — просто продолжает урок. */
  /* mascot: 'full' — полная анимация, 'calm' — только смена поз без движения,
     'off' — талисмана нет вовсе. Значение переживает перезагрузку, потому что
     это не украшение, а решение ученика: кому-то живой персонаж помогает
     заниматься, кому-то мешает сосредоточиться, и спрашивать об этом каждый
     раз — неуважение к обоим.
     sound по умолчанию выключен: платформу открывают в классе, где двадцать
     устройств одновременно.  */
  settings: { lang: 'ru', tts: true, cloudAI: true, reducedMotion: false, mascot: 'full', sound: false },
  ui: { onboarded: false },
});

/**
 * Регионы раньше хранились готовой русской строкой, а после перевода интерфейса
 * стали ключами словаря. У тех, кто уже открывал приложение, в localStorage
 * лежит старое значение, поэтому переводим его один раз при загрузке —
 * иначе в казахском и английском кабинете осталась бы русская подпись.
 */
const LEGACY_REGIONS = {
  'Астана': 'reg.astana',
  'Алматы': 'reg.almaty',
  'Шымкент': 'reg.shymkent',
  'Туркестанская область': 'reg.turkestan',
  'Кызылординская область': 'reg.kyzylorda',
  'Актюбинская область': 'reg.aktobe',
  'Жамбылская область': 'reg.zhambyl',
  'Восточно-Казахстанская область': 'reg.vko',
  'Павлодарская область': 'reg.pavlodar',
  'Атырауская область': 'reg.atyrau',
  'Другой регион': 'reg.other',
};

function migrateProfile(profile) {
  const region = LEGACY_REGIONS[profile.region] || profile.region;
  // Имя по умолчанию тоже было записано строкой; пустое имя подставит текущий язык.
  const name = profile.name === 'Ученик' ? '' : profile.name;
  return { ...profile, region, name };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    // Демо-класс до перевода хранился с готовыми строками названия и школы.
    // Такой объект больше не отрисовать, поэтому берём свежий из seed.
    const klass = parsed.klass?.students?.length && parsed.klass.nameKey ? parsed.klass : base.klass;
    return {
      ...base,
      ...parsed,
      profile: migrateProfile({ ...base.profile, ...parsed.profile }),
      settings: { ...base.settings, ...parsed.settings },
      klass,
    };
  } catch (e) {
    console.warn('AQYL: состояние не прочитано, начинаем с чистого профиля', e);
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
