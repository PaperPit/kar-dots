import { el } from '../../../ui/ui.js';
import { segControl } from '../shared.js';

interface SettingsLike {
  showCalendar?: string;
  calendarPlace?: string;
  streakRingDays?: number;
}

export function buildCalendarGroup(s: SettingsLike, save: () => void) {
  const calendarPlace = s.calendarPlace
    ?? (s.showCalendar === 'hidden' ? 'hidden' : s.showCalendar === 'right' ? 'right' : 'left');

  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Календарь'),
    el('div', { class: 'setting-row settings-desktop-only' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'На главной (компьютер)'),
        el('span', null, 'Слева или справа от «Повторения дня», либо скрыть. На телефоне календарь всегда сверху свёрнутой полоской.'),
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
        el('span', null, 'За сколько дней подряд заполняется круг вокруг кубка (если используется).'),
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
