import { el } from '../../ui/ui.js';

interface SegOption {
  v: string;
  label: string;
}

export function segControl(value: string | undefined, options: SegOption[], onChange: (v: string) => void) {
  const seg = el('div', { class: 'seg', role: 'group' }, []);
  options.forEach((o: SegOption) => {
    const active = o.v === value;
    const b = el('button', {
      type: 'button',
      class: active ? 'active' : '',
      'aria-pressed': active ? 'true' : 'false',
    }, o.label) as HTMLButtonElement;
    b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach((x: Element) => {
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

export function statTile(label: string, value: unknown) {
  return el('div', { class: 'stat-tile' }, [
    el('div', { class: 'stat-tile-val tnum' }, String(value)),
    el('div', { class: 'stat-tile-lab' }, label),
  ]);
}
