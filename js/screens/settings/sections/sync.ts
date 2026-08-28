import { el, toast } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';
import type { AppStore } from '../../../core/state.js';

interface DeadLetterRow {
  id?: number;
  op?: string;
  error?: string;
  failed_at?: number;
}

/** Полный список dead letters + ручной flush — только для legacy cloud (Supabase). */
export function buildSyncGroup(store: AppStore, route: () => void | Promise<void>) {
  if (store.kind !== 'cloud') {
    return null;
  }

  const statusEl = el('span', { class: 'integrations-status muted' }, t('settings.sync.loading'));
  const listEl = el('div', { class: 'settings-sync-list' }, []);

  async function refresh() {
    const pending = typeof store.pendingSync === 'function' ? await store.pendingSync() : 0;
    const failed = typeof store.deadLetterCount === 'function' ? await store.deadLetterCount() : 0;
    statusEl.textContent = t('settings.sync.status', { pending, failed });

    listEl.replaceChildren();
    if (failed <= 0 || typeof store.deadLetters !== 'function') {
      if (failed <= 0) {
        listEl.append(el('p', { class: 'muted' }, t('settings.sync.noDead')));
      }
      return;
    }

    const letters = (await store.deadLetters()) as DeadLetterRow[];
    for (const letter of letters) {
      const id = letter.id;
      if (id == null) continue;
      const when = letter.failed_at
        ? new Date(letter.failed_at).toLocaleString()
        : '';
      const row = el('div', { class: 'setting-row settings-sync-dead' }, [
        el('div', { class: 'lab' }, [
          el('b', null, String(letter.op || 'op')),
          el('span', null, letter.error || t('shell.sync.errorTitle')),
          when ? el('span', { class: 'muted' }, when) : null,
        ]),
        el('div', { class: 'settings-sync-actions' }, [
          el('button', {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              const ok = await store.retryDeadLetter(id);
              toast(
                ok ? t('shell.sync.retryStarted') : t('shell.sync.alreadyHandled'),
                ok ? 'ok' : 'error',
              );
              await refresh();
              if (ok) await route();
            },
          }, t('settings.sync.retry')),
          el('button', {
            class: 'btn ghost',
            type: 'button',
            onclick: async () => {
              const ok = await store.discardDeadLetter(id);
              toast(ok ? t('shell.sync.discarded') : t('shell.sync.alreadyHandled'));
              await refresh();
            },
          }, t('settings.sync.discard')),
        ]),
      ]);
      listEl.append(row);
    }
  }

  void refresh();

  if (typeof store.onSyncChange === 'function') {
    store.onSyncChange(() => {
      void refresh();
    });
  }

  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.sync.title')),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.sync.queue')),
        statusEl,
      ]),
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: async () => {
          try {
            const cloudish = store as unknown as { syncActivityNow?: () => Promise<unknown> };
            if (typeof cloudish.syncActivityNow === 'function') {
              await cloudish.syncActivityNow();
            }
            const r = await store.flushSync();
            toast(
              r.fail
                ? t('shell.sync.doneFail', { ok: r.ok, fail: r.fail })
                : t('shell.sync.doneOk', { ok: r.ok }),
              r.fail ? 'error' : 'ok',
            );
            await refresh();
            await route();
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), 'error');
          }
        },
      }, t('settings.sync.flush')),
    ]),
    listEl,
  ]);
}
