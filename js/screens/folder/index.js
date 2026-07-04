import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import { el, toast, confirmDialog, stripHtml } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowTombIcon, featherIcon, initials, newBudget, scarecrowBox, svgNode, textPreview } from '../../ui/helpers.js';
import { shell, nav, offlineBanner } from '../../ui/shell.js';
import { folderDialog } from '../home/folder-dialog.js';
import { cardDialog } from '../card-editor/index.js';
import { route } from '../../core/router.js';

export async function renderFolder(folderId) {
  const folder = store.folders.find(f => f.id === folderId);
  if (!folder) { nav('#home'); return; }

  const cards = await store.getFolderCards(folderId);
  const algo = store.settings.algo;
  const due = (await store.countDue(folderId)) + Math.min(await store.countNew(folderId), newBudget());

  const head = el('div', { class: 'page-head' }, [
    el('button', { class: 'icon-btn', onclick: () => nav('#home') }, svgNode(ICONS.back)),
    el('div', { class: 'swatch', style: { background: folder.color, width: '30px', height: '30px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: '800', fontSize: '13px' } }, initials(folder.name)),
    el('h2', { class: 'page-title grow' }, folder.name),
    el('button', { class: 'icon-btn', title: 'Переименовать', onclick: () => folderDialog(folder) }, featherIcon()),
    el('button', {
      class: 'icon-btn', title: 'Удалить папку',
      onclick: async () => {
        const yes = await confirmDialog('Удалить папку?',
          `«${folder.name}» и все её карточки (${cards.length}) будут удалены навсегда.`, 'Удалить', true,
          crowTombIcon());
        if (!yes) return;
        await store.deleteFolder(folderId);
        toast('Папка удалена');
        nav('#home');
      },
    }, svgNode(ICONS.trash)),
  ]);

  const actions = el('div', { class: 'row', style: { marginBottom: '18px', flexWrap: 'wrap' } }, [
    el('button', { class: 'btn primary', onclick: () => cardDialog(folderId) }, [svgNode(ICONS.plus), 'Добавить карточку']),
    due > 0 ? el('button', { class: 'btn accent', onclick: () => nav('#review/' + folderId) }, [svgNode(ICONS.play), `Повторить (${due})`]) : null,
  ]);

  const list = el('div', { class: 'card-list' });
  cards.forEach((c, i) => list.append(cardRow(c, i, algo)));

  const content = [offlineBanner(), head, actions];
  if (!cards.length) {
    content.push(el('div', { class: 'review-hero' }, [
      scarecrowBox(),
      el('div', { class: 'grow' }, [
        el('h2', null, ['Добавь ещё пару ', el('span', { class: 'kar' }, 'КАР'), 'точек — чтобы мне было что поклевать.']),
      ]),
    ]));
  } else {
    content.push(list);
  }
  shell('home', el('div', null, content));

  function cardRow(c, i, algoName) {
    const img = c.front_img || c.back_img;
    let chip;
    if (SRS.isNew(c, algoName)) chip = el('span', { class: 'srs-chip new' }, 'новая');
    else if (SRS.isDue(c, algoName)) chip = el('span', { class: 'srs-chip due' }, 'пора');
    else {
      const d = SRS.dueOf(c, algoName);
      chip = el('span', { class: 'srs-chip' }, 'через ' + SRS.fmtDays(Math.max(1, Math.round((d - Date.now()) / 86400000))));
    }
    const row = el('div', {
      class: 'card-row', style: { animationDelay: Math.min(i * 30, 400) + 'ms' },
      onclick: () => cardDialog(c.folder_id, c),
    }, [
      img ? el('img', { class: 'thumb', src: img, alt: '' }) : null,
      el('div', { class: 'texts' }, [
        el('div', { class: 'front' }, stripHtml(c.front) || '(картинка)'),
        el('div', { class: 'back' }, stripHtml(c.back) || ''),
      ]),
      chip,
      el('button', {
        class: 'icon-btn', title: 'Удалить',
        onclick: async e => {
          e.stopPropagation();
          const yes = await confirmDialog('Удалить карточку?', textPreview(c), 'Удалить', true, crowTombIcon());
          if (!yes) return;
          row.classList.add('removing');
          setTimeout(async () => {
            await store.deleteCard(c.id);
            await route();
            toast('Карточка удалена');
          }, 250);
        },
      }, svgNode(ICONS.trash)),
    ]);
    return row;
  }
}
