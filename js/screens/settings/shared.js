import { el } from '../../ui/ui.js';

export function segControl(value, options, onChange) {
  const seg = el('div', { class: 'seg', role: 'group' });
  options.forEach(o => {
    const active = o.v === value;
    const b = el('button', {
      type: 'button',
      class: active ? 'active' : '',
      'aria-pressed': active ? 'true' : 'false',
    }, o.label);
    b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach(x => {
        x.classList.remove('active');
        x.setAttribute('aria-pressed', 'false');
      });
      b.classList.add('active');
      b.setAttribute('aria-pressed', 'true');
      onChange(o.v);
    });
    seg.append(b);
  });
  return seg;
}

export function statTile(label, value) {
  return el('div', { class: 'stat-tile' }, [
    el('div', { class: 'stat-tile-val tnum' }, String(value)),
    el('div', { class: 'stat-tile-lab' }, label),
  ]);
}
