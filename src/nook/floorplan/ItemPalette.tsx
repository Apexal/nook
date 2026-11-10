import type { ItemKind } from '../types';
import { cx, useControlled } from '../util';
import { FLOORS, KINDS, closetBody, closetFront } from './kinds';

/** Small square drawing of an item kind. */
export function ItemThumb({ kind }: { kind: ItemKind }) {
  const k = KINDS[kind];
  if (k.wall) {
    return (
      <svg className="nk-thumb" viewBox="-2 -4 14 14" aria-hidden="true">
        <rect x={-1} y={-1.2} width={12} height={2.4} className="nk-fp-thumb-wall" />
        {k.draw(10, kind === 'door' ? 10 : 1)}
      </svg>
    );
  }
  const w = k.w, h = kind === 'closet' ? k.h + 1 : k.h, m = Math.max(w, h) + 3;
  return (
    <svg className="nk-thumb" viewBox={`${w / 2 - m / 2} ${h / 2 - m / 2} ${m} ${m}`} aria-hidden="true">
      {kind === 'closet' ? <>{closetBody(k.w, k.h)}{closetFront(k.w, k.h)}</> : k.draw(w, h)}
    </svg>
  );
}

export interface ItemPaletteProps {
  kinds?: ItemKind[];
  showFloors?: boolean;
  /** Armed tool: an item kind ("bed") or a floor ("floor:carpet"). Tap again to disarm. */
  value?: string | null;
  defaultValue?: string | null;
  onPick?: (value: string | null) => void;
  className?: string;
}
const ORDER = ['Furniture', 'Floors & decor', 'Plants', 'Kitchen & bath', 'Structure'];

/** The editor's catalogue. Tap a tile to arm it, then tap the plan to place it. */
export function ItemPalette({ kinds = Object.keys(KINDS) as ItemKind[], showFloors = true, value, defaultValue = null, onPick, className }: ItemPaletteProps) {
  const [cur, setCur] = useControlled<string | null>(value, defaultValue, onPick);
  const tap = (v: string) => setCur(cur === v ? null : v);
  const groups = ORDER.map((g) => [g, kinds.filter((k) => KINDS[k]?.group === g)] as const).filter(([, ks]) => ks.length);
  return (
    <div className={cx('nk-palette', className)}>
      {showFloors && (
        <div>
          <div className="nk-palette__head">Floors</div>
          <div className="nk-palette__grid">
            {(Object.keys(FLOORS) as (keyof typeof FLOORS)[]).map((f) => (
              <button key={f} type="button" className="nk-palette__tile" aria-pressed={cur === 'floor:' + f} onClick={() => tap('floor:' + f)}>
                <span className={`nk-palette__floor nk-mat-${f}`} /><span className="nk-palette__label">{FLOORS[f]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {groups.map(([g, ks]) => (
        <div key={g}>
          <div className="nk-palette__head">{g}</div>
          <div className="nk-palette__grid">
            {ks.map((k) => (
              <button key={k} type="button" className="nk-palette__tile" aria-pressed={cur === k} onClick={() => tap(k)}>
                <ItemThumb kind={k} /><span className="nk-palette__label">{KINDS[k].label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
