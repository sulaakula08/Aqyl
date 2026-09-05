/**
 * Вход и синхронизация — блок в подвале боковой панели.
 *
 * Позиция выбрана намеренно. Вход у нас не входной барьер: ученик открывает
 * сайт и сразу занимается, без регистрации. Аккаунт нужен ровно для одного —
 * перенести прогресс между телефоном и школьным компьютером. Поэтому кнопка
 * живёт внизу панели, а не в модальном окне поверх первого экрана.
 *
 * Если Supabase не настроен, блока нет вовсе: показывать «Войти», который
 * ничего не делает, хуже, чем не показывать ничего.
 */

import { action, toast } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n.js';
import { getState, update } from '../state.js';
import {
  isConfigured, getUser, signInWithGoogle, signOut, pullProfile, pushProfile,
} from '../cloud/supabase.js';

let syncing = false;

/** Возвращает разметку блока (строка), либо '' — когда вход недоступен. */
export function renderAuthBlock() {
  if (!isConfigured()) return '';

  const user = getUser();
  if (!user) {
    return `
      <button class="btn btn-block btn-sm side-google" data-act="auth-google">
        ${icon('google', 15)} ${t('auth.google')}
      </button>
      <p class="side-note">${t('auth.why')}</p>`;
  }

  const name = user.user_metadata?.full_name || user.email || '';
  const avatar = user.user_metadata?.avatar_url;

  return `
    <div class="side-user">
      ${avatar
        ? `<img class="side-avatar" src="${escapeAttr(avatar)}" alt="" width="28" height="28" referrerpolicy="no-referrer">`
        : `<span class="side-avatar side-avatar-fb">${icon('user', 15)}</span>`}
      <span class="side-user-name" title="${escapeAttr(name)}">${escapeHtml(name)}</span>
      <button class="icon-btn side-out" data-act="auth-out" aria-label="${t('auth.signOut')}" title="${t('auth.signOut')}">
        ${icon('logout', 14)}
      </button>
    </div>
    <button class="btn btn-block btn-sm" data-act="auth-sync" ${syncing ? 'disabled' : ''}>
      ${syncing ? t('auth.syncing') : t('auth.sync')}
    </button>`;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = escapeHtml;

/**
 * Слияние облачного и локального прогресса.
 *
 * Конфликт здесь реален: ученик решал задания на телефоне в автобусе без
 * сети, а до этого — на школьном компьютере. Побеждает не «последний
 * записавший», а более полная история: затереть тридцать решённых заданий
 * пятью только потому, что пять сохранились позже, — худшее, что может
 * сделать синхронизация. Поэтому сравниваем длину журнала попыток.
 */
function mergeProfiles(localP, remoteP) {
  if (!remoteP) return localP;
  const localN = localP.history?.length || 0;
  const remoteN = remoteP.history?.length || 0;
  if (remoteN > localN) return remoteP;
  if (localN > remoteN) return localP;
  // Журналы равны — берём тот, где больше опыта: он не меньше по смыслу.
  return (remoteP.xp || 0) > (localP.xp || 0) ? remoteP : localP;
}

async function doSync(rerender) {
  if (syncing) return;
  syncing = true;
  rerender();

  try {
    const remote = await pullProfile();
    const local = getState().profile;
    const merged = mergeProfiles(local, remote?.data);

    if (merged !== local) {
      update((st) => { st.profile = { ...st.profile, ...merged }; });
      toast(t('auth.pulled'));
    }
    await pushProfile(getState().profile);
    toast(t('auth.synced'));
  } catch (e) {
    console.warn('AQYL: синхронизация не удалась', e);
    toast(t('auth.syncFail'));
  } finally {
    syncing = false;
    rerender();
  }
}

export function registerAuthActions(rerender) {
  action('auth-google', () => {
    if (!navigator.onLine) return toast(t('auth.needNet'));
    signInWithGoogle();
  });

  action('auth-out', () => {
    signOut();
    toast(t('auth.signedOut'));
    rerender();
  });

  action('auth-sync', () => doSync(rerender));
}

/** Тихая синхронизация после входа — чтобы прогресс подтянулся сам. */
export async function syncAfterLogin(rerender) {
  if (!isConfigured() || !getUser()) return;
  await doSync(rerender);
}
