import type { ReactNode } from 'react';
import type { ItemKind, Pt } from '../types';

/* Top-down drawings in local plan units (decimetres), origin top-left, size w × h. */
const R = (x: number, y: number, w: number, h: number, r: number, c: string) => <rect x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} rx={r} className={c} />;
const C = (x: number, y: number, r: number, c: string) => <circle cx={x} cy={y} r={r} className={c} />;
const L = (x1: number, y1: number, x2: number, y2: number, c = 'nk-fp-detail') => <line x1={x1} y1={y1} x2={x2} y2={y2} className={c} />;
const E = (cx: number, cy: number, rx: number, ry: number, c: string, rot = 0) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} className={c} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined} />;

type Draw = (w: number, h: number, pts?: Pt[]) => ReactNode;
export interface KindDef { label: string; group: string; w: number; h: number; draw: Draw; /** sits on a wall; rotates about (x, y) */ wall?: boolean; /** corners can be dragged into an L or U, like rooms */ shapeable?: boolean; /** a wall piece that can still have chores (windows) */ chores?: boolean }

const bed: Draw = (w, h) => {
  const pw = (w - 3) / 2, ph = Math.min(4, h * 0.16);
  return <>{R(0, 0, w, h, 1, 'nk-fp-fixture')}{R(1, 1, pw, ph, 0.8, 'nk-fp-soft')}{R(2 + pw, 1, pw, ph, 0.8, 'nk-fp-soft')}{R(0.6, ph + 2, w - 1.2, h - ph - 2.6, 0.8, 'nk-fp-soft')}{L(0.6, ph + 4.5, w - 0.6, ph + 4.5)}</>;
};
/** Shaped sofa: back along top edges, arms on the outer left and right edges, inner and bottom edges open (seat fronts). */
const sectional = (w: number, pts: Pt[]) => {
  const bands: ReactNode[] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    if (a[1] === b[1] && a[1] === 0 && a[0] !== b[0]) bands.push(<rect key={i} x={Math.min(a[0], b[0])} y={0} width={Math.abs(b[0] - a[0])} height={2.6} rx={1.2} className="nk-fp-soft" />);
    else if (a[0] === b[0] && (a[0] === 0 || a[0] === w) && a[1] !== b[1]) bands.push(<rect key={i} x={a[0] === 0 ? 0 : w - 2.5} y={Math.min(a[1], b[1])} width={2.5} height={Math.abs(b[1] - a[1])} rx={1.2} className="nk-fp-soft" />);
  });
  return <><path d={'M' + pts.map((q) => `${q[0]} ${q[1]}`).join(' L') + ' Z'} className="nk-fp-fixture" strokeLinejoin="round" />{bands}</>;
};
const sofa: Draw = (w, h, pts) => {
  if (pts && pts.length > 4) return sectional(w, pts);
  const n = Math.max(2, Math.round((w - 5) / 8)), sw = (w - 5) / n;
  return <>{R(0, 0, w, h, 1.4, 'nk-fp-fixture')}{R(0, 0, w, 2.6, 1.2, 'nk-fp-soft')}{R(0, 0, 2.5, h, 1.2, 'nk-fp-soft')}{R(w - 2.5, 0, 2.5, h, 1.2, 'nk-fp-soft')}
    {Array.from({ length: n - 1 }, (_, i) => <line key={i} x1={2.5 + (i + 1) * sw} y1={2.6} x2={2.5 + (i + 1) * sw} y2={h - 0.6} className="nk-fp-detail" />)}</>;
};
const plant: Draw = (w, h) => {
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
  return <>{Array.from({ length: 6 }, (_, i) => { const a = (i * Math.PI) / 3, ex = cx + Math.cos(a) * r * 0.5, ey = cy + Math.sin(a) * r * 0.5;
    return <ellipse key={i} cx={ex} cy={ey} rx={r * 0.5} ry={r * 0.3} transform={`rotate(${i * 60} ${ex} ${ey})`} className="nk-fp-plant" />; })}{C(cx, cy, r * 0.28, 'nk-fp-plant-deep')}</>;
};
const flowers: Draw = (w, h) => {
  const n = Math.max(2, Math.round(w / 3));
  return <>{R(0, 0, w, h, 0.8, 'nk-fp-soft')}{Array.from({ length: n }, (_, i) => { const x = ((i + 0.5) * w) / n;
    return <g key={i}>{C(x, h / 2, Math.min(1.3, h * 0.32), i % 2 ? 'nk-fp-plant' : 'nk-fp-flower')}{C(x, h / 2, 0.4, 'nk-fp-plant-deep')}</g>; })}</>;
};
const stove: Draw = (w, h) => { const r = Math.min(w, h) * 0.16; return <>{R(0, 0, w, h, 0.5, 'nk-fp-appliance')}{C(w * 0.28, h * 0.3, r, 'nk-fp-burner')}{C(w * 0.72, h * 0.3, r, 'nk-fp-burner')}{C(w * 0.28, h * 0.7, r, 'nk-fp-burner')}{C(w * 0.72, h * 0.7, r, 'nk-fp-burner')}</>; };

/** Closet body: back wall on top, opening along the bottom edge. Rotate it to face the room. */
export const closetBody = (w: number, h: number) => {
  const rod = h * 0.45, ticks: ReactNode[] = [];
  for (let x = 1.6, i = 0; x < w - 1; x += 1.4, i++) ticks.push(<line key={i} x1={x} y1={rod - 1.5} x2={x} y2={rod + 1.5} className="nk-fp-hanger" />);
  return <>{R(0, 0, w, h, 0, 'nk-fp-closet')}<path d={`M0 ${h} V0 H${w} V${h}`} className="nk-fp-wall-thin" />{ticks}</>;
};
export const closetFront = (w: number, h: number, style: 'sliding' | 'hinged' | 'none' = 'sliding') => {
  const rod = L(0.8, h * 0.45, w - 0.8, h * 0.45);
  if (style === 'none') return rod;
  if (style === 'hinged') {
    const q = w / 2;
    return <>{rod}<path d={`M0 ${h} A${q} ${q} 0 0 0 ${q} ${h + q}`} className="nk-fp-swing" />{L(0, h, 0, h + q, 'nk-fp-leaf')}<path d={`M${w} ${h} A${q} ${q} 0 0 1 ${q} ${h + q}`} className="nk-fp-swing" />{L(w, h, w, h + q, 'nk-fp-leaf')}</>;
  }
  return <>{rod}{L(0, h - 0.4, w * 0.56, h - 0.4, 'nk-fp-leaf')}{L(w * 0.44, h + 0.5, w, h + 0.5, 'nk-fp-leaf')}</>;
};

export const KINDS: Record<ItemKind, KindDef> = {
  bed: { label: 'Bed', group: 'Furniture', w: 16, h: 20, draw: bed },
  sofa: { label: 'Sofa', group: 'Furniture', w: 24, h: 9, draw: sofa, shapeable: true },
  armchair: { label: 'Armchair', group: 'Furniture', w: 9, h: 9, draw: (w, h) => <>{R(0, 0, w, h, 1.4, 'nk-fp-fixture')}{R(0, 0, w, 2.4, 1.2, 'nk-fp-soft')}{R(0, 0, 2.2, h, 1.1, 'nk-fp-soft')}{R(w - 2.2, 0, 2.2, h, 1.1, 'nk-fp-soft')}</> },
  table: { label: 'Table', group: 'Furniture', w: 14, h: 9, draw: (w, h) => R(0, 0, w, h, 1, 'nk-fp-fixture') },
  roundtable: { label: 'Round table', group: 'Furniture', w: 10, h: 10, draw: (w, h) => E(w / 2, h / 2, w / 2, h / 2, 'nk-fp-fixture') },
  chair: { label: 'Chair', group: 'Furniture', w: 4.5, h: 4.5, draw: (w, h) => <>{R(0, 0, w, h, 1.2, 'nk-fp-fixture')}{R(0, 0, w, 1.2, 0.6, 'nk-fp-soft')}</> },
  desk: { label: 'Desk', group: 'Furniture', w: 14, h: 7, draw: (w, h) => <>{R(0, 0, w, h, 0.8, 'nk-fp-fixture')}{R(w * 0.3, 0.8, w * 0.4, 1.2, 0.5, 'nk-fp-tv')}</> },
  nightstand: { label: 'Nightstand', group: 'Furniture', w: 4.5, h: 4, draw: (w, h) => <>{R(0, 0, w, h, 0.8, 'nk-fp-fixture')}{C(w / 2, h / 2, Math.min(w, h) * 0.26, 'nk-fp-soft')}</> },
  wardrobe: { label: 'Wardrobe', group: 'Furniture', w: 16, h: 6, draw: (w, h) => <>{R(0, 0, w, h, 0.6, 'nk-fp-fixture')}{L(w / 2, 0.4, w / 2, h - 0.4)}{L(1, h / 2, w / 2 - 1, h / 2)}{L(w / 2 + 1, h / 2, w - 1, h / 2)}</> },
  shelf: { label: 'Bookshelf', group: 'Furniture', w: 12, h: 3.5, draw: (w, h) => <>{R(0, 0, w, h, 0.5, 'nk-fp-fixture')}{L(w / 4, 0.3, w / 4, h - 0.3)}{L(w / 2, 0.3, w / 2, h - 0.3)}{L((3 * w) / 4, 0.3, (3 * w) / 4, h - 0.3)}</> },
  tv: { label: 'TV stand', group: 'Furniture', w: 18, h: 4, draw: (w, h) => <>{R(0, 0, w, h, 0.6, 'nk-fp-fixture')}{R(w * 0.15, h * 0.35, w * 0.7, h * 0.3, 0.3, 'nk-fp-tv')}</> },
  rug: { label: 'Rug', group: 'Floors & decor', w: 20, h: 14, draw: (w, h) => <>{R(0, 0, w, h, 0.6, 'nk-fp-rug')}{R(1.2, 1.2, w - 2.4, h - 2.4, 0.4, 'nk-fp-rug-inner')}</> },
  plant: { label: 'Plant', group: 'Plants', w: 6, h: 6, draw: plant },
  flowers: { label: 'Flower box', group: 'Plants', w: 12, h: 4, draw: flowers },
  counter: { label: 'Counter', group: 'Kitchen & bath', w: 20, h: 6, draw: (w, h) => R(0, 0, w, h, 0.3, 'nk-fp-counter') },
  fridge: { label: 'Fridge', group: 'Kitchen & bath', w: 7, h: 7, draw: (w, h) => <>{R(0, 0, w, h, 0.6, 'nk-fp-appliance')}{L(0.4, h - 1.3, w - 0.4, h - 1.3)}{L(w * 0.3, h - 0.7, w * 0.7, h - 0.7)}</> },
  stove: { label: 'Stove', group: 'Kitchen & bath', w: 7, h: 6, draw: stove },
  sink: { label: 'Sink', group: 'Kitchen & bath', w: 8, h: 6, draw: (w, h) => <>{R(0, 0, w, h, 0.5, 'nk-fp-counter')}{R(1, 1, w - 2, h - 2, 1.2, 'nk-fp-water')}{C(w / 2, h / 2, 0.45, 'nk-fp-burner')}</> },
  dishwasher: { label: 'Dishwasher', group: 'Kitchen & bath', w: 6, h: 6, draw: (w, h) => <>{R(0, 0, w, h, 0.5, 'nk-fp-appliance')}{L(0.6, h - 1.2, w - 0.6, h - 1.2)}</> },
  // back on top, doors along the bottom edge: rotate it to face the kitchen
  pantry: { label: 'Pantry', group: 'Kitchen & bath', w: 9, h: 6, draw: (w, h) => <>{R(0, 0, w, h, 0.5, 'nk-fp-fixture')}{L(0.7, h * 0.25, w - 0.7, h * 0.25)}{L(0.7, h * 0.5, w - 0.7, h * 0.5)}{L(w / 2, h * 0.68, w / 2, h - 0.3)}{L(0.3, h - 0.3, w - 0.3, h - 0.3)}{C(w / 2 - 0.7, h - 1.1, 0.3, 'nk-fp-burner')}{C(w / 2 + 0.7, h - 1.1, 0.3, 'nk-fp-burner')}</> },
  coffee: { label: 'Coffee machine', group: 'Kitchen & bath', w: 3.5, h: 4, draw: (w, h) => <>{R(0, 0, w, h, 0.8, 'nk-fp-appliance')}{C(w / 2, h * 0.6, Math.min(w, h) * 0.25, 'nk-fp-tv')}</> },
  washer: { label: 'Washer', group: 'Kitchen & bath', w: 6.5, h: 6.5, draw: (w, h) => <>{R(0, 0, w, h, 0.6, 'nk-fp-appliance')}{C(w / 2, h / 2 + 0.3, Math.min(w, h) * 0.3, 'nk-fp-water')}{L(0.8, 1.1, w * 0.4, 1.1)}</> },
  dryer: { label: 'Dryer', group: 'Kitchen & bath', w: 6.5, h: 6.5, draw: (w, h) => <>{R(0, 0, w, h, 0.6, 'nk-fp-appliance')}{C(w / 2, h / 2 + 0.3, Math.min(w, h) * 0.3, 'nk-fp-soft')}{L(0.8, 1.1, w * 0.4, 1.1)}</> },
  washdry: { label: 'Washer/dryer stack', group: 'Kitchen & bath', w: 6.5, h: 7, draw: (w, h) => <>{R(0, 0, w, h, 0.6, 'nk-fp-appliance')}{R(0.5, 0.5, w - 1, h - 1, 0.4, 'nk-fp-appliance')}{L(0.8, 1.6, w - 0.8, 1.6)}{C(w / 2, h / 2 + 0.6, Math.min(w, h) * 0.28, 'nk-fp-soft')}{C(w / 2, h / 2 + 0.6, Math.min(w, h) * 0.13, 'nk-fp-water')}</> },
  trash: { label: 'Trash can', group: 'Kitchen & bath', w: 4, h: 4, draw: (w, h) => <>{R(0, 0, w, h, Math.min(w, h) * 0.3, 'nk-fp-appliance')}{R(0.6, 0.6, w - 1.2, h - 1.2, Math.min(w, h) * 0.22, 'nk-fp-burner')}{L(w * 0.3, h - 0.3, w * 0.7, h - 0.3)}</> },
  toilet: { label: 'Toilet', group: 'Kitchen & bath', w: 4.5, h: 7, draw: (w, h) => <>{R(0, 0, w, h * 0.3, 0.5, 'nk-fp-fixture')}{E(w / 2, h * 0.62, w * 0.42, h * 0.36, 'nk-fp-fixture')}{E(w / 2, h * 0.64, w * 0.24, h * 0.22, 'nk-fp-water')}</> },
  tub: { label: 'Bathtub', group: 'Kitchen & bath', w: 17, h: 7.5, draw: (w, h) => <>{R(0, 0, w, h, 1.4, 'nk-fp-fixture')}{R(1.2, 1.2, w - 2.4, h - 2.4, Math.min(3, (h - 2.4) / 2), 'nk-fp-water')}{C(w - 3, h / 2, 0.5, 'nk-fp-burner')}</> },
  shower: { label: 'Shower', group: 'Kitchen & bath', w: 9, h: 9, draw: (w, h) => <>{R(0, 0, w, h, 0.6, 'nk-fp-fixture')}{R(0.8, 0.8, w - 1.6, h - 1.6, 0.4, 'nk-fp-water')}{L(0.8, 0.8, w - 0.8, h - 0.8)}{C(w / 2, h / 2, 0.5, 'nk-fp-burner')}</> },
  closet: { label: 'Closet', group: 'Structure', w: 16, h: 6, draw: (w, h) => <>{closetBody(w, h)}{closetFront(w, h)}</> },
  door: { label: 'Door', group: 'Structure', w: 8, h: 8, wall: true, draw: (w) => <>{R(0, -0.7, w, 1.4, 0, 'nk-fp-threshold')}<path d={`M${w} 0 A${w} ${w} 0 0 1 0 ${w}`} className="nk-fp-swing" />{L(0, 0, 0, w, 'nk-fp-leaf')}</> },
  slider: { label: 'Sliding door', group: 'Structure', w: 10, h: 1, wall: true, draw: (w) => <>{R(0, -0.7, w, 1.4, 0, 'nk-fp-threshold')}{L(0, -0.35, w * 0.56, -0.35, 'nk-fp-leaf')}{L(w * 0.44, 0.35, w, 0.35, 'nk-fp-leaf')}</> },
  opening: { label: 'Opening', group: 'Structure', w: 10, h: 1, wall: true, draw: (w) => R(0, -0.7, w, 1.4, 0, 'nk-fp-threshold') },
  window: { label: 'Window', group: 'Structure', w: 12, h: 1, wall: true, chores: true, draw: (w) => <>{R(0, -0.9, w, 1.8, 0, 'nk-fp-window')}{L(0, 0, w, 0, 'nk-fp-window-pane')}</> },
};
export const itemKinds = KINDS;
export const FLOORS = { wood: 'Wood', vinyl: 'Vinyl', tile: 'Tile', carpet: 'Carpet', concrete: 'Concrete' } as const;

/** Whether chores can be assigned to this kind: everything except doors, sliders and openings. */
export const takesChores = (kind: ItemKind) => !!KINDS[kind] && (!KINDS[kind].wall || !!KINDS[kind].chores);
