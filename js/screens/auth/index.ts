import { store, sb, cloudConfigured, app, setStore } from '../../core/state.js';
import { el, toast, spinner } from '../../ui/ui.js';
import { LocalStore } from '../../data/index.js';
import { FOLDER_COLORS } from '../../ui/constants.js';
import { brandMark, ghostBox } from '../../ui/helpers.js';
import { nav } from '../../ui/shell.js';
import { route, parseHash } from '../../core/router.js';
import { animateFadeIn } from '../../ui/motion-lazy.js';
import { applyUiLocale, t } from '../../lib/i18n.js';
import type { CloudStore } from '../../data/store-cloud.js';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** После фоновой синхронизации перерисовать экран (кроме активной сессии повторения). */
export function attachCloudDataReload(cloud: CloudStore) {
  cloud.onDataChange(() => {
    if (parseHash(location.hash).name === 'review') return;
    route();
  });
}

export function renderAuth(busyMsg?: string) {
  if (!app) return;
  app.innerHTML = '';
  const content = el('div', { class: 'auth-wrap' }, []);
  content.append(
    ghostBox(),
    brandMark({ heading: true }),
    el('p', { class: 'auth-sub' }, t('auth.sub'))
  );

  if (busyMsg) {
    content.append(el('div', { class: 'center-pad' }, [spinner(undefined), el('p', { class: 'auth-note' }, busyMsg)]));
    app.append(el('main', { class: 'main' }, content));
    requestAnimationFrame(() => animateFadeIn(content));
    return;
  }

  const email = el('input', { class: 'input', type: 'email', placeholder: t('auth.emailPlaceholder'), autocomplete: 'email' }, []) as HTMLInputElement;
  const pass = el('input', { class: 'input', type: 'password', placeholder: t('auth.passwordPlaceholder'), autocomplete: 'current-password' }, []) as HTMLInputElement;
  const btnIn = el('button', { class: 'btn primary block big' }, t('auth.signIn')) as HTMLButtonElement;
  const btnUp = el('button', { class: 'link-btn' }, t('auth.signUp')) as HTMLButtonElement;

  async function doAuth(signup: boolean) {
    if (!email.value.trim() || pass.value.length < 6) {
      toast(t('auth.needCredentials'), 'error'); return;
    }
    btnIn.disabled = true;
    try {
      if (!sb) { btnIn.disabled = false; return; }
      if (signup) {
        const r = await sb.signUp(email.value.trim(), pass.value);
        if (r.needConfirm) {
          toast(t('auth.confirmEmail'), 'ok');
          btnIn.disabled = false;
          return;
        }
      } else {
        await sb.signIn(email.value.trim(), pass.value);
      }
      await enterCloud();
    } catch (e) {
      toast(errMsg(e), 'error');
      btnIn.disabled = false;
    }
  }
  btnIn.addEventListener('click', () => doAuth(false));
  btnUp.addEventListener('click', () => doAuth(true));
  pass.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') doAuth(false); });

  const cloudCard = el('div', { class: 'auth-card' }, cloudConfigured
    ? [
        el('div', { class: 'field' }, email),
        el('div', { class: 'field' }, pass),
        btnIn,
        el('p', { class: 'auth-note' }, [t('auth.noAccount'), btnUp]),
      ]
    : [
        el('p', { class: 'modal-text modal-text-flush' },
          t('auth.cloudNotConfigured')),
      ]
  );

  const demoBtn = el('button', {
    class: 'btn block big',
    onclick: async () => {
      localStorage.setItem('kar_mode', 'local');
      renderAuth(t('auth.opening'));
      await enterLocal();
    },
  }, t('auth.tryLocal')) as HTMLButtonElement;

  content.append(cloudCard, el('div', { class: 'auth-or' }, '· · ·'), demoBtn,
    el('p', { class: 'auth-note' }, t('auth.demoNote')));
  app.append(el('main', { class: 'main' }, content));
  requestAnimationFrame(() => animateFadeIn(content));
}

export async function enterLocal() {
  const local = new LocalStore();
  await local.init();
  setStore(local);
  applyUiLocale(local.settings.language);
  if (!store.folders.length && !localStorage.getItem('kar_seeded')) {
    localStorage.setItem('kar_seeded', '1');
    const f = await local.createFolder({ name: t('auth.seed.folderName'), color: FOLDER_COLORS[0] });
    await local.createCard({
      folder_id: f.id,
      front: t('auth.seed.cardFront'),
      back: t('auth.seed.cardBack'),
    });
  }
  nav('#home');
  await route();
}

export async function enterCloud() {
  localStorage.setItem('kar_mode', 'cloud');
  renderAuth(t('auth.loadingCloud'));
  try {
    const { CloudStore } = await import('../../data/store-cloud.js');
    if (!sb) throw new Error(t('auth.cloudMissingKeys'));
    const cloud = new CloudStore(sb);
    await cloud.init();
    setStore(cloud);
    applyUiLocale(cloud.settings.language);
    attachCloudDataReload(cloud);
    // Первое устройство / пустое зеркало: не уходим на пустой home, пока облако не ответит.
    if (navigator.onLine && !cloud.folders.length && !cloud.boxes.length) {
      await cloud.whenCloudReady();
    }
    if (navigator.onLine) {
      await cloud.whenCloudReady();
      await cloud.syncActivityNow();
    }
    nav('#home');
    await route();
    const { tryExtConnectAfterLogin } = await import('../../lib/ext-connect.js');
    tryExtConnectAfterLogin();
    } catch (e) {
      setStore(null);
      toast(t('auth.loadFailed', { message: errMsg(e) }), 'error');
      renderAuth();
    }
}
