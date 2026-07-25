import { el } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';
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
    el('h4', null, t('settings.calendar.title')),
    el('div', { class: 'setting-row settings-desktop-only' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.calendar.desktopLabel')),
        el('span', null, t('settings.calendar.desktopHint')),
      ]),
      segControl(calendarPlace, [
        { v: 'left', label: t('settings.calendar.left') },
        { v: 'right', label: t('settings.calendar.right') },
      ], v => {
        s.calendarPlace = v;
        save();
      }),
    ]),
  ]);
}
