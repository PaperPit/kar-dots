import { el } from '../../../ui/ui.js';
import { segControl } from '../shared.js';

export function buildCalendarGroup(s, save) {
  const calendarPlace = s.calendarPlace ?? (s.showCalendar === false ? 'hidden' : 'left');
  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Календарь'),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Показывать на главной'),
        el('span', null, 'Где отображать календарь на экране «Папки». На телефоне — компактная полоска, по нажатию раскрывается.'),
      ]),
      segControl(calendarPlace, [
        { v: 'left', label: 'Слева' },
        { v: 'right', label: 'Справа' },
        { v: 'hidden', label: 'Скрыть' },
      ], v => {
        s.calendarPlace = v;
        save();
      }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Полное кольцо серии'),
        el('span', null, 'За сколько дней подряд заполняется круг вокруг кубка в календаре.'),
      ]),
      (() => {
        const inp = el('input', {
          type: 'number', min: 1, max: 999,
          value: s.streakRingDays ?? 21,
        });
        inp.addEventListener('change', () => {
          s.streakRingDays = Math.max(1, Number(inp.value) || 21);
          inp.value = String(s.streakRingDays);
          save();
        });
        return inp;
      })(),
    ]),
  ]);
}
