/**
 * Набор иконок.
 *
 * Раньше интерфейс использовал эмодзи (🔥, 💡, 🔒, 🔊). Это дёшево в вёрстке,
 * но эмодзи рисует шрифт операционной системы: на Windows они цветные и
 * глянцевые, на Android — другой формы, в печати — вообще квадраты. Продукт,
 * который держится на тонких линейках и одном акценте, от такого рассыпается.
 *
 * Здесь — один контурный набор: viewBox 24×24, обводка currentColor,
 * толщина 1.6, скруглённые концы. Иконка наследует цвет и размер текста,
 * работает в обеих темах и печатается чёрным.
 */

const P = {
  /* Оболочка */
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  theme: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 0 0 15z" fill="currentColor" stroke="none"/>',
  arrowRight: '<path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5"/>',
  arrowLeft: '<path d="M19.5 12h-15M11 5.5L4.5 12 11 18.5"/>',

  /* Учебный процесс */
  hint: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.5 9.5a4 4 0 0 1 0 5M18 7a7.5 7.5 0 0 1 0 10"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',

  /* Талисман — тот же силуэт птенца, что и у самого персонажа, только
     контуром: кнопка обязана быть узнаваемой как «это про Бүркіта». */
  bird: '<path d="M12 4.5a4.2 4.2 0 0 1 4.2 4.2c0 .8-.2 1.4-.5 2 1.6 1 2.6 2.7 2.6 4.6 0 3-2.8 4.7-6.3 4.7S5.7 18.3 5.7 15.3c0-1.9 1-3.6 2.6-4.6a4 4 0 0 1-.5-2A4.2 4.2 0 0 1 12 4.5z"/><path d="M10.6 8.4h.01M13.4 8.4h.01" stroke-width="2.2"/>',

  /* Режимы репетитора */
  cloud: '<path d="M7.5 19h9.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.7 3.9 3.9 0 0 0 7.5 19z"/>',
  bolt: '<path d="M13.5 2.5L5 13.5h5.5L10 21.5l8.5-11H13z"/>',

  /* Достижения — узнаваемые силуэты, а не абстракции */
  sprout: '<path d="M12 21v-7.5"/><path d="M12 13.5C12 10 9.5 7.5 5.5 7.5c0 3.9 2.6 6 6.5 6z"/><path d="M12 13.5c0-3 2-5.5 5.5-5.5 0 3.4-2.2 5.5-5.5 5.5z"/>',
  stack: '<path d="M3.5 8.5L12 4l8.5 4.5L12 13z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
  mountain: '<path d="M2.5 19.5L9 7l4 7 2.5-4 6 9.5z"/><path d="M6.6 12.2l2.6 1.8 2-1.4"/>',
  flame: '<path d="M12 21c3.3 0 6-2.4 6-5.6 0-4-3.2-5.6-4-12.4-2.4 1.6-4 4-4 6.4 0 1.6-1 2.4-1.8 1.6-.6-.6-.8-1.6-.8-2.4C5.8 10.4 6 12.4 6 15.4 6 18.6 8.7 21 12 21z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  trend: '<path d="M3.5 17l5.5-5.5 3.5 3.5L20.5 7"/><path d="M15.5 7h5v5"/>',

  /* Разделы боковой панели */
  home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M9.5 20.5v-6h5v6"/>',
  graph: '<circle cx="5.5" cy="17.5" r="2.5"/><circle cx="12" cy="6" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/><path d="M10.8 8.2L7 15.3M13.2 8.2L17 15.3M8 17.5h8"/>',
  chat: '<path d="M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 20.5l1.6-3.9A6.6 6.6 0 0 1 4 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7z"/>',
  users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M16 5.9a3 3 0 0 1 0 5.2M17.5 19.5a5.5 5.5 0 0 0-2.2-4.4"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
  logout: '<path d="M14.5 8V5.5a1.5 1.5 0 0 0-1.5-1.5H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h7a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="M10 12h10.5M17.5 8.5L21 12l-3.5 3.5"/>',
  google: '<path d="M20.5 12.2c0-.7-.06-1.2-.2-1.8H12v3.4h4.9c-.1.8-.63 2-1.8 2.8l-.02.1 2.6 2 .18.02c1.66-1.5 2.62-3.8 2.62-6.5z" fill="currentColor" stroke="none"/><path d="M12 21c2.4 0 4.4-.8 5.86-2.1l-2.8-2.2c-.75.5-1.75.9-3.06.9-2.33 0-4.3-1.5-5.02-3.6l-.1.01-2.7 2.1-.04.1A9 9 0 0 0 12 21z" fill="currentColor" stroke="none"/><path d="M6.98 14c-.19-.56-.3-1.16-.3-1.78 0-.62.11-1.22.29-1.78l-.005-.12-2.74-2.13-.09.04A9 9 0 0 0 3 12.22a9 9 0 0 0 .98 4.1z" fill="currentColor" stroke="none"/><path d="M12 6.84c1.65 0 2.77.72 3.4 1.32l2.5-2.44A8.7 8.7 0 0 0 12 3.44a9 9 0 0 0-8.02 4.9l2.83 2.2C7.7 8.34 9.67 6.84 12 6.84z" fill="currentColor" stroke="none"/>',

  /* Предметы */
  sigma: '<path d="M17.5 5.5h-11l6 6.5-6 6.5h11"/>',
  atom: '<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="9.5" ry="4" /><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(120 12 12)"/>',
};

/**
 * @param {string} name  ключ из набора
 * @param {number} size  размер в пикселях (по умолчанию наследует кегль текста)
 */
export function icon(name, size) {
  const body = P[name];
  if (!body) return '';
  const dim = size ? `width="${size}" height="${size}"` : 'width="1em" height="1em"';
  return `<svg class="ic" viewBox="0 0 24 24" ${dim} fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** Иконка внутри уже существующего <svg> (граф знаний): без обёртки, со сдвигом. */
export function iconGlyph(name, x, y, size = 14) {
  const body = P[name];
  if (!body) return '';
  const s = size / 24;
  return `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${s.toFixed(4)})"
    fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${body}</g>`;
}

export const ICON_NAMES = Object.keys(P);
