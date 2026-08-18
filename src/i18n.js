/**
 * Мультиязычность: қазақша / русский / English.
 * В Казахстане это не «бонусная фича», а условие доступности: в сельских
 * школах обучение часто идёт на казахском, а качественных цифровых
 * материалов на нём кратно меньше.
 */

import { lang } from './state.js';

// Реэкспорт: страницам удобнее брать и словарь, и текущий язык из одного модуля.
export { lang };

const DICT = {
  ru: {
    'nav.home': 'Главная', 'nav.dashboard': 'Кабинет', 'nav.graph': 'Карта знаний',
    'nav.tutor': 'AI-репетитор', 'nav.teacher': 'Учителю', 'nav.plan': 'План',
    'cta.start': 'Начать обучение', 'cta.diagnostic': 'Пройти диагностику',
    'cta.continue': 'Продолжить', 'cta.next': 'Далее', 'cta.check': 'Проверить',
    'cta.hint': 'Подсказка', 'cta.explain': 'Объяснить', 'cta.practice': 'Практиковать',
    'cta.finish': 'Завершить', 'cta.back': 'Назад', 'cta.skip': 'Пропустить',
    'hero.kicker': 'AI-репетитор для каждой школы Казахстана',
    'hero.title': 'Твой уровень — не приговор. Это стартовая точка.',
    'hero.sub': 'AQYL находит настоящую причину пробела в знаниях, а не симптом. Персональный план, объяснимый ИИ и работа без интернета — для школ, где его почти нет.',
    'stat.students': 'школьников в Казахстане', 'stat.gap': 'разрыв село / город в PISA',
    'stat.tutors': 'семей не могут позволить репетитора', 'stat.teachers': 'учеников на одного учителя',
    'sec.how': 'Как это работает', 'sec.why': 'Почему это не ещё один сборник задач',
    'onb.title': 'Расскажи о себе', 'onb.grade': 'Класс', 'onb.subject': 'Предметы',
    'onb.goal': 'Цель обучения', 'onb.exam': 'Дата экзамена', 'onb.name': 'Имя',
    'onb.region': 'Регион', 'onb.school': 'Школа',
    'diag.title': 'Адаптивная диагностика', 'diag.sub': 'Вопросы подстраиваются под твои ответы. 8 заданий — и мы знаем, где пробел.',
    'diag.q': 'Вопрос', 'diag.of': 'из', 'diag.result': 'Твоя стартовая карта знаний',
    'dash.hi': 'Привет', 'dash.solved': 'решённых заданий', 'dash.topicsOf': 'освоено {a} из {b} тем',
    'dash.gate': 'Сначала — диагностика', 'dash.gateSub': 'Чтобы построить персональный маршрут, системе нужно 8 ответов. Это займёт около трёх минут.',
    'dash.level': 'Уровень', 'dash.xp': 'Опыт', 'dash.streak': 'Дней подряд',
    'dash.next': 'Что делать дальше', 'dash.weak': 'Слабые места', 'dash.progress': 'Прогресс по темам',
    'dash.deadline': 'До экзамена', 'dash.days': 'дн.', 'dash.badges': 'Достижения',
    'why.gap': 'Пробел в знаниях', 'why.blocked': 'Не хватает базы', 'why.goal': 'Ведёт к твоей цели',
    'why.leverage': 'Откроет новые темы', 'why.review': 'Пора повторить',
    'band.mastered': 'Освоено', 'band.strong': 'Уверенно', 'band.developing': 'В процессе', 'band.gap': 'Пробел',
    'learn.correct': 'Верно', 'learn.wrong': 'Пока не то', 'learn.explain': 'Разбор',
    'learn.misconception': 'Типичная ошибка', 'learn.chance': 'Шанс справиться',
    'teacher.title': 'Панель учителя', 'teacher.risk': 'Требуют внимания',
    'teacher.heatmap': 'Карта класса', 'teacher.add': 'Добавить модуль',
    'teacher.insight': 'Вывод ИИ по классу', 'teacher.students': 'учеников',
    'tutor.title': 'AI-репетитор', 'tutor.placeholder': 'Спроси про любую тему…',
    'tutor.offline': 'Офлайн-режим', 'tutor.cloud': 'Claude API',
    'graph.title': 'Карта знаний', 'graph.sub': 'Каждая тема опирается на предыдущие. Нажми на узел, чтобы увидеть путь.',
    'plan.title': 'Индивидуальный план', 'plan.week': 'Неделя', 'plan.hours': 'ч',
    'plan.ontrack': 'Ты успеваешь к экзамену', 'plan.behind': 'При текущем темпе не успеваешь',
    'common.mastery': 'освоено', 'common.topic': 'Тема', 'common.grade': 'класс',
    'common.reset': 'Сбросить прогресс', 'common.settings': 'Настройки', 'common.listen': 'Прослушать',
  },
  kk: {
    'nav.home': 'Басты бет', 'nav.dashboard': 'Кабинет', 'nav.graph': 'Білім картасы',
    'nav.tutor': 'AI-ұстаз', 'nav.teacher': 'Мұғалімге', 'nav.plan': 'Жоспар',
    'cta.start': 'Оқуды бастау', 'cta.diagnostic': 'Диагностикадан өту',
    'cta.continue': 'Жалғастыру', 'cta.next': 'Әрі қарай', 'cta.check': 'Тексеру',
    'cta.hint': 'Нұсқау', 'cta.explain': 'Түсіндіру', 'cta.practice': 'Жаттығу',
    'cta.finish': 'Аяқтау', 'cta.back': 'Артқа', 'cta.skip': 'Өткізу',
    'hero.kicker': 'Қазақстанның әр мектебіне арналған AI-ұстаз',
    'hero.title': 'Деңгейің — үкім емес. Бұл — бастау нүктесі.',
    'hero.sub': 'AQYL білім олқылығының салдарын емес, нақты себебін табады. Жеке жоспар, түсіндірілетін ИИ және интернетсіз жұмыс.',
    'stat.students': 'оқушы Қазақстанда', 'stat.gap': 'ауыл мен қала арасындағы PISA айырмасы',
    'stat.tutors': 'отбасы репетитор жалдай алмайды', 'stat.teachers': 'оқушыға бір мұғалім',
    'sec.how': 'Қалай жұмыс істейді', 'sec.why': 'Неге бұл жай есептер жинағы емес',
    'onb.title': 'Өзің туралы айт', 'onb.grade': 'Сынып', 'onb.subject': 'Пәндер',
    'onb.goal': 'Оқу мақсаты', 'onb.exam': 'Емтихан күні', 'onb.name': 'Аты',
    'onb.region': 'Өңір', 'onb.school': 'Мектеп',
    'diag.title': 'Бейімделетін диагностика', 'diag.sub': 'Сұрақтар жауабыңа қарай өзгереді. 8 тапсырма — және олқылық анықталады.',
    'diag.q': 'Сұрақ', 'diag.of': '/', 'diag.result': 'Бастапқы білім картаң',
    'dash.hi': 'Сәлем', 'dash.solved': 'шешілген тапсырма', 'dash.topicsOf': '{b} тақырыптың {a}-і игерілді',
    'dash.gate': 'Алдымен — диагностика', 'dash.gateSub': 'Жеке маршрут құру үшін жүйеге 8 жауап қажет. Бұл шамамен үш минут алады.',
    'dash.level': 'Деңгей', 'dash.xp': 'Тәжірибе', 'dash.streak': 'Қатарынан күн',
    'dash.next': 'Әрі қарай не істеу керек', 'dash.weak': 'Осал тұстар', 'dash.progress': 'Тақырыптар бойынша прогресс',
    'dash.deadline': 'Емтиханға дейін', 'dash.days': 'күн', 'dash.badges': 'Жетістіктер',
    'why.gap': 'Білім олқылығы', 'why.blocked': 'Негіз жетіспейді', 'why.goal': 'Мақсатыңа апарады',
    'why.leverage': 'Жаңа тақырыптар ашады', 'why.review': 'Қайталау уақыты',
    'band.mastered': 'Игерілді', 'band.strong': 'Сенімді', 'band.developing': 'Үдерісте', 'band.gap': 'Олқылық',
    'learn.correct': 'Дұрыс', 'learn.wrong': 'Әзірге дұрыс емес', 'learn.explain': 'Талдау',
    'learn.misconception': 'Жиі кездесетін қате', 'learn.chance': 'Сәттілік мүмкіндігі',
    'teacher.title': 'Мұғалім панелі', 'teacher.risk': 'Назар аудару қажет',
    'teacher.heatmap': 'Сынып картасы', 'teacher.add': 'Модуль қосу',
    'teacher.insight': 'Сынып бойынша ИИ қорытындысы', 'teacher.students': 'оқушы',
    'tutor.title': 'AI-ұстаз', 'tutor.placeholder': 'Кез келген тақырыпты сұра…',
    'tutor.offline': 'Офлайн режим', 'tutor.cloud': 'Claude API',
    'graph.title': 'Білім картасы', 'graph.sub': 'Әр тақырып алдыңғысына сүйенеді. Жолды көру үшін түйінді бас.',
    'plan.title': 'Жеке жоспар', 'plan.week': 'Апта', 'plan.hours': 'сағ',
    'plan.ontrack': 'Емтиханға үлгересің', 'plan.behind': 'Қазіргі қарқынмен үлгермейсің',
    'common.mastery': 'игерілді', 'common.topic': 'Тақырып', 'common.grade': 'сынып',
    'common.reset': 'Прогресті тазалау', 'common.settings': 'Баптаулар', 'common.listen': 'Тыңдау',
  },
  en: {
    'nav.home': 'Home', 'nav.dashboard': 'Dashboard', 'nav.graph': 'Knowledge map',
    'nav.tutor': 'AI tutor', 'nav.teacher': 'Teacher', 'nav.plan': 'Plan',
    'cta.start': 'Start learning', 'cta.diagnostic': 'Take diagnostic',
    'cta.continue': 'Continue', 'cta.next': 'Next', 'cta.check': 'Check',
    'cta.hint': 'Hint', 'cta.explain': 'Explain', 'cta.practice': 'Practice',
    'cta.finish': 'Finish', 'cta.back': 'Back', 'cta.skip': 'Skip',
    'hero.kicker': 'An AI tutor for every school in Kazakhstan',
    'hero.title': 'Your level is not a verdict. It is a starting point.',
    'hero.sub': 'AQYL finds the real cause of a knowledge gap, not the symptom. A personal plan, explainable AI, and full offline operation.',
    'stat.students': 'school students in Kazakhstan', 'stat.gap': 'rural / urban PISA gap',
    'stat.tutors': 'of families cannot afford a tutor', 'stat.teachers': 'students per teacher',
    'sec.how': 'How it works', 'sec.why': 'Why this is not another problem set',
    'onb.title': 'Tell us about yourself', 'onb.grade': 'Grade', 'onb.subject': 'Subjects',
    'onb.goal': 'Learning goal', 'onb.exam': 'Exam date', 'onb.name': 'Name',
    'onb.region': 'Region', 'onb.school': 'School',
    'diag.title': 'Adaptive diagnostic', 'diag.sub': 'Questions adapt to your answers. 8 tasks to locate the gap.',
    'diag.q': 'Question', 'diag.of': 'of', 'diag.result': 'Your starting knowledge map',
    'dash.hi': 'Hi', 'dash.solved': 'tasks solved', 'dash.topicsOf': '{a} of {b} topics mastered',
    'dash.gate': 'Diagnostic first', 'dash.gateSub': 'The system needs 8 answers to build your route. It takes about three minutes.',
    'dash.level': 'Level', 'dash.xp': 'XP', 'dash.streak': 'Day streak',
    'dash.next': 'What to do next', 'dash.weak': 'Weak spots', 'dash.progress': 'Topic progress',
    'dash.deadline': 'Until exam', 'dash.days': 'd', 'dash.badges': 'Badges',
    'why.gap': 'Knowledge gap', 'why.blocked': 'Missing foundation', 'why.goal': 'Leads to your goal',
    'why.leverage': 'Unlocks new topics', 'why.review': 'Time to review',
    'band.mastered': 'Mastered', 'band.strong': 'Strong', 'band.developing': 'Developing', 'band.gap': 'Gap',
    'learn.correct': 'Correct', 'learn.wrong': 'Not quite', 'learn.explain': 'Walkthrough',
    'learn.misconception': 'Common mistake', 'learn.chance': 'Success chance',
    'teacher.title': 'Teacher dashboard', 'teacher.risk': 'Need attention',
    'teacher.heatmap': 'Class map', 'teacher.add': 'Add module',
    'teacher.insight': 'AI class insight', 'teacher.students': 'students',
    'tutor.title': 'AI tutor', 'tutor.placeholder': 'Ask about any topic…',
    'tutor.offline': 'Offline mode', 'tutor.cloud': 'Claude API',
    'graph.title': 'Knowledge map', 'graph.sub': 'Each topic builds on earlier ones. Tap a node to see the path.',
    'plan.title': 'Personal plan', 'plan.week': 'Week', 'plan.hours': 'h',
    'plan.ontrack': 'You are on track', 'plan.behind': 'Behind schedule at current pace',
    'common.mastery': 'mastered', 'common.topic': 'Topic', 'common.grade': 'grade',
    'common.reset': 'Reset progress', 'common.settings': 'Settings', 'common.listen': 'Listen',
  },
};

export function t(key) {
  const l = lang();
  return DICT[l]?.[key] ?? DICT.ru[key] ?? key;
}

/** Строка с подстановкой: tf('dash.topicsOf', { a: 3, b: 11 }). */
export function tf(key, vars = {}) {
  return t(key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/** Локализованное поле объекта вида { ru, kk, en }. */
export function loc(obj, fallbackKey = 'ru') {
  if (!obj) return '';
  return obj[lang()] || obj[fallbackKey] || '';
}

export const LANGS = [
  { id: 'kk', label: 'ҚАЗ' },
  { id: 'ru', label: 'РУС' },
  { id: 'en', label: 'ENG' },
];

/** Код языка для Web Speech API (озвучка для учеников с трудностями чтения). */
export const speechLocale = () => ({ kk: 'kk-KZ', ru: 'ru-RU', en: 'en-US' }[lang()] || 'ru-RU');
