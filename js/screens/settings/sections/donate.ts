import { el, toast } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';

export function buildDonateGroup() {
  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.donate.title')),
    el('p', { class: 'muted' }, t('settings.donate.lead')),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Boosty'),
        el('span', null, t('settings.donate.boostyHint')),
      ]),
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          window.open('https://boosty.to/kar-dots', '_blank', 'noopener,noreferrer');
        },
      }, t('common.open')),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Ko-fi'),
        el('span', null, t('settings.donate.kofiHint')),
      ]),
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          window.open('https://ko-fi.com/kardots', '_blank', 'noopener,noreferrer');
        },
      }, t('common.open')),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'USDT (TRC-20)'),
        el('span', null, t('settings.donate.cryptoHint')),
      ]),
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          toast(t('settings.donate.cryptoAddressCopied'), 'ok');
        },
      }, t('settings.donate.copyAddress')),
    ]),
  ]);
}
