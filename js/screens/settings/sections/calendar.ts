import { el } from '../../../ui/ui.js';
import { segControl } from '../shared.js';

interface SettingsLike {
  showCalendar?: string;
  calendarPlace?: string;
}

function resolveCalendarPlace(s: SettingsLike): 'left' | 'right' {
  const raw = s.calendarPlace
    ?? (s.showCalendar === 'right' ? 'right' : 'left');
  return raw === 'right' ? 'right' : 'left';
}

export function buildCalendarGroup(s: SettingsLike, save: () => void) {
  const calendarPlace = resolveCalendarPlace(s);
  // Старое значение «скрыт» больше недоступно — сбрасываем на слева/справа
  if (s.calendarPlace === 'hidden' || s.showCalendar === 'hidden') {
    s.calendarPlace = calendarPlace;
    save();
  }

  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Календарь'),
    el('div', { class: 'setting-row settings-desktop-only' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'На главной (компьютер)'),
        el('span', null, 'Слева или справа от «Повторения дня». На телефоне календарь всегда сверху свёрнутой полоской.'),
      ]),
      segControl(calendarPlace, [
        { v: 'left', label: 'Слева' },
        { v: 'right', label: 'Справа' },
      ], v => {
        s.calendarPlace = v;
        save();
      }),
    ]),
  ]);
}
