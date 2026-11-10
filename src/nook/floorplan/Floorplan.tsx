import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as RKeyboardEvent, MouseEvent as RMouseEvent, PointerEvent as RPointerEvent, ReactNode } from 'react';
import { HEAT_WORDS } from '../heat';
import type { ItemKind, Plan, PlanChange, PlanItem, PlanRoom, Pt } from '../types';
import { cx, useControlled } from '../util';
import { KINDS, closetBody, closetFront } from './kinds';

export interface FloorplanProps {
  plan: Plan;
  /** heat = chore heatmap · edit = grid + handles, no tint · plain = materials only */
  mode?: 'heat' | 'edit' | 'plain';
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Edit mode: fired once per drag (move / resize / rotate an item, drag a room corner, add a wall step). Persist it. */
  onChange?: (change: PlanChange) => void;
  /** Edit mode with an armed palette tool: a tap on the plan asks to place it here (snapped). */
  onPlace?: (p: { kind: string; x: number; y: number; roomId: string | null }) => void;
  armedKind?: string | null;
  /** Grid snap for moves and placing, in plan units (1 = 10 cm, 5 = 0.5 m). Sizes and corners snap to 1 (10 cm). */
  snap?: number;
  showLabels?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const MAX_ZOOM = 6;
type View = { z: number; cx: number; cy: number };
type Gesture =
  | { kind: 'pinch'; d0: number; z0: number; at: { x: number; y: number } }
  | { kind: 'pan'; x0: number; y0: number; cx0: number; cy0: number; moved: boolean };
type Geo = { x: number; y: number; w: number; h: number; r: number };
type Drag =
  | { kind: 'move' | 'rot'; id: string; g0: Geo; p0: DOMPoint }
  | { kind: 'size'; id: string; g0: Geo; p0: DOMPoint; corner: 'nw' | 'ne' | 'sw' | 'se' }
  | { kind: 'vertex'; id: string; v: number; pts0: Pt[]; p0: DOMPoint }
  | { kind: 'ivertex'; id: string; v: number; pts0: Pt[]; g0: Geo; p0: DOMPoint };

export const roomPoints = (r: PlanRoom): Pt[] =>
  r.points ?? [[r.x!, r.y!], [r.x! + r.w!, r.y!], [r.x! + r.w!, r.y! + r.h!], [r.x!, r.y! + r.h!]];
const bbox = (p: Pt[]) => { const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
const pathD = (p: Pt[]) => 'M' + p.map((q) => `${q[0]} ${q[1]}`).join(' L') + ' Z';
const r2 = (v: number) => Math.round(v * 100) / 100;
/** A shapeable item's corners in its own units (a plain rectangle until reshaped). */
const itemPts = (it: PlanItem): Pt[] => { const g = itemGeo(it); return it.points ?? [[0, 0], [g.w, 0], [g.w, g.h], [0, g.h]]; };
const itemGeo = (it: PlanItem): Geo => ({ x: it.x, y: it.y, w: it.w ?? KINDS[it.kind].w, h: it.h ?? KINDS[it.kind].h, r: it.r ?? 0 });
const extent = (g: Geo) => { const a = (g.r * Math.PI) / 180; return [(Math.abs(g.w * Math.cos(a)) + Math.abs(g.h * Math.sin(a))) / 2, (Math.abs(g.w * Math.sin(a)) + Math.abs(g.h * Math.cos(a))) / 2]; };

/** Bounding box of everything drawn (outline, rooms, items). Falls back to plan width × height when the plan is empty. */
export function planBounds(p: Plan) {
  const pts: Pt[] = [...(p.outline ?? []), ...p.rooms.flatMap(roomPoints)];
  for (const it of p.items) {
    const g = itemGeo(it);
    if (KINDS[it.kind]?.wall) { const a = (g.r * Math.PI) / 180; pts.push([g.x, g.y], [g.x + g.w * Math.cos(a), g.y + g.w * Math.sin(a)]); continue; }
    const [ew, eh] = extent(g), cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    pts.push([cx - ew, cy - eh], [cx + ew, cy + eh]);
  }
  return pts.length ? bbox(pts) : { x: 0, y: 0, w: p.width, h: p.height };
}

/** Drag corner i to (nx, ny); its two neighbours follow so every edge stays horizontal or vertical. */
function moveCorner(pts0: Pt[], i: number, nx: number, ny: number) {
  const P = pts0.map((q) => [...q] as Pt), n = P.length, o = orientation(pts0), prev = (i - 1 + n) % n, next = (i + 1) % n;
  P[i] = [nx, ny];
  if (o(prev) === 'h') P[prev][1] = ny; else P[prev][0] = nx;
  if (o(i) === 'h') P[next][1] = ny; else P[next][0] = nx;
  return P;
}
/** Insert a flat step (two doubled corners) across the middle third of edge i, ready to be dragged out. */
function withStep(pts: Pt[], i: number) {
  const p = pts.map((q) => [...q] as Pt), a = p[i], b = p[(i + 1) % p.length], q = (v: number) => Math.round(v);
  const m1: Pt = [q(a[0] + (b[0] - a[0]) / 3), q(a[1] + (b[1] - a[1]) / 3)], m2: Pt = [q(a[0] + (2 * (b[0] - a[0])) / 3), q(a[1] + (2 * (b[1] - a[1])) / 3)];
  p.splice(i + 1, 0, m1, [...m1] as Pt, m2, [...m2] as Pt);
  return p;
}

/** Right-angled polygons alternate horizontal and vertical edges. Returns each edge's orientation. */
function orientation(p: Pt[]) {
  let j = 0, base: 'h' | 'v' = 'h';
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if (a[0] !== b[0] || a[1] !== b[1]) { j = i; base = a[1] === b[1] ? 'h' : 'v'; break; } }
  return (k: number) => ((((k - j) % 2) + 2) % 2 === 0 ? base : base === 'h' ? 'v' : 'h');
}

/** The apartment, top-down. Heat mode tints floors and items by their hottest chore; edit mode moves, resizes and reshapes. */
export function Floorplan({ plan, mode = 'heat', selectedId, defaultSelectedId = null, onSelect, onChange, onPlace, armedKind, snap = 1, showLabels = true, label = 'Apartment floorplan', className, style }: FloorplanProps) {
  const uid = 'fp' + useId().replace(/[^a-zA-Z0-9]/g, '');
  // The plan as drawn, including a drag in progress. Reset during render (not in an effect) when a new plan
  // comes in, so the heat map doesn't paint the old plan for a frame and then render again every minute.
  const [draft, setDraft] = useState(plan);
  const [shown, setShown] = useState(plan);
  if (shown !== plan) { setShown(plan); setDraft(plan); }
  const [sel, setSel] = useControlled<string | null>(selectedId, defaultSelectedId, onSelect);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const last = useRef<PlanChange | null>(null);
  const swallow = useRef(false);
  const heat = mode === 'heat', edit = mode === 'edit';
  const pad = edit ? 12 : 3;
  const url = (n: string) => `url(#${uid}-${n})`;

  // Edit mode: track the panel size so the grid fills it, whatever shape the plan is.
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<[number, number] | null>(null);
  useEffect(() => {
    const el = boxRef.current; if (!edit || !el) return;
    const ro = new ResizeObserver(([e]) => { const { width, height } = e.contentRect; if (width > 0 && height > 0) setBox([width, height]); });
    ro.observe(el); return () => ro.disconnect();
  }, [edit]);
  // Frame the committed plan (not the draft), so the view doesn't shift under the pointer mid-drag.
  const b = planBounds(plan);
  let vx = b.x - pad, vy = b.y - pad, vw = b.w + 2 * pad, vh = b.h + 2 * pad;
  if (edit && box) {
    const ar = box[0] / box[1];
    if (vw / vh < ar) { const nw = vh * ar; vx -= (nw - vw) / 2; vw = nw; } else { const nh = vw / ar; vy -= (nh - vh) / 2; vh = nh; }
  }
  const s = (v: number, step = snap) => Math.round(v / step) * step;

  // Zoom: 1 = the whole plan. The view is a centre (plan units) and a factor, clamped so it never leaves the framed plan.
  const [view, setView] = useState<View>({ z: 1, cx: 0, cy: 0 });
  const zw = vw / view.z, zh = vh / view.z;
  const zx = Math.min(Math.max(view.cx - zw / 2, vx), vx + vw - zw), zy = Math.min(Math.max(view.cy - zh / 2, vy), vy + vh - zh);
  const frame = useRef({ vx, vy, vw, vh, zx, zy, zw, zh });
  frame.current = { vx, vy, vw, vh, zx, zy, zw, zh };
  /** Zoom to `z`, keeping plan point `at` under the screen point (clientX, clientY). */
  const zoomTo = useCallback((z: number, clientX: number, clientY: number, at?: { x: number; y: number }) => {
    const svg = svgRef.current; if (!svg) return;
    const f = frame.current, r = svg.getBoundingClientRect(), k = Math.min(r.width / f.zw, r.height / f.zh);
    const fx = (clientX - r.left - (r.width - f.zw * k) / 2) / (f.zw * k), fy = (clientY - r.top - (r.height - f.zh * k) / 2) / (f.zh * k);
    const a = at ?? { x: f.zx + fx * f.zw, y: f.zy + fy * f.zh };
    const nz = Math.min(Math.max(z, 1), MAX_ZOOM), nw = f.vw / nz, nh = f.vh / nz;
    setView({ z: nz, cx: a.x - fx * nw + nw / 2, cy: a.y - fy * nh + nh / 2 });
  }, []);
  const zoomRef = useRef(1);
  zoomRef.current = view.z;

  // Scroll wheel and trackpad pinch (which browsers send as wheel + ctrlKey). Not passive, so the page doesn't scroll or zoom too.
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      zoomTo(zoomRef.current * Math.exp(-px * (e.ctrlKey ? 0.01 : 0.002)), e.clientX, e.clientY);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  // Touch pinch (two pointers) and drag-to-pan (one pointer on anything that isn't being dragged).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const pinchStart = () => {
    const [a, b] = [...pointers.current.values()], f = frame.current, svg = svgRef.current!, r = svg.getBoundingClientRect();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, k = Math.min(r.width / f.zw, r.height / f.zh);
    const at = { x: f.zx + (mx - r.left - (r.width - f.zw * k) / 2) / k, y: f.zy + (my - r.top - (r.height - f.zh * k) / 2) / k };
    gesture.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: zoomRef.current, at };
  };
  const onDownCapture = (e: RPointerEvent) => {
    // the first finger (or a mouse press) starts a fresh gesture: forget stale pointers and any click left to swallow
    if (e.isPrimary) { pointers.current.clear(); gesture.current = null; if (!drag.current) swallow.current = false; }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // a second finger turns any item drag into a pinch
      if (drag.current) { drag.current = null; last.current = null; setDraft(plan); }
      e.stopPropagation(); e.preventDefault();
      pinchStart();
      try { svgRef.current!.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  };
  const onDown = (e: RPointerEvent) => {
    if (drag.current || pointers.current.size !== 1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // no pointer capture yet: a plain tap must still land on the room or item under it
    gesture.current = { kind: 'pan', x0: e.clientX, y0: e.clientY, cx0: frame.current.zx + frame.current.zw / 2, cy0: frame.current.zy + frame.current.zh / 2, moved: false };
  };
  const gestureMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current; if (!g) return false;
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()]; if (!b) return true;
      zoomTo(g.z0 * Math.hypot(a.x - b.x, a.y - b.y) / g.d0, (a.x + b.x) / 2, (a.y + b.y) / 2, g.at);
      return true;
    }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.moved && Math.hypot(dx, dy) < 6) return true;
    if (!g.moved) { g.moved = true; try { svgRef.current!.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    if (zoomRef.current <= 1) return true;
    const r = svgRef.current!.getBoundingClientRect(), f = frame.current, k = Math.min(r.width / f.zw, r.height / f.zh);
    setView((v) => ({ ...v, cx: g.cx0 - dx / k, cy: g.cy0 - dy / k }));
    return true;
  };
  const gestureEnd = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current; if (!g) return;
    if (g.kind === 'pinch' || g.moved) swallow.current = true;   // the click that follows isn't a tap
    if (g.kind === 'pinch' && pointers.current.size === 1) {
      // one finger still down: carry on as a pan from here
      const [p] = [...pointers.current.values()], f = frame.current;
      gesture.current = { kind: 'pan', x0: p.x, y0: p.y, cx0: f.zx + f.zw / 2, cy0: f.zy + f.zh / 2, moved: true };
    } else if (pointers.current.size === 0) gesture.current = null;
  };

  const pt = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!, p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const setItem = (id: string, g: Geo, points?: Pt[]) => setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, x: r2(g.x), y: r2(g.y), w: r2(g.w), h: r2(g.h), r: g.r, ...(points && { points }) } : it)) }));
  const setRoom = (id: string, points: Pt[]) => setDraft((d) => ({ ...d, rooms: d.rooms.map((rm) => (rm.id === id ? { ...rm, points, x: undefined, y: undefined, w: undefined, h: undefined } : rm)) }));

  const begin = (e: RPointerEvent, d: Drag) => {
    if (!edit) return;
    e.stopPropagation(); e.preventDefault();
    drag.current = d; last.current = null;
    try { svgRef.current!.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onMove = (e: RPointerEvent) => {
    if (gestureMove(e)) return;
    const d = drag.current; if (!d) return;
    const p = pt(e), dx = p.x - d.p0.x, dy = p.y - d.p0.y;
    if (d.kind === 'vertex') {
      const P = moveCorner(d.pts0, d.v, s(d.pts0[d.v][0] + dx, 1), s(d.pts0[d.v][1] + dy, 1));
      setRoom(d.id, P); last.current = { id: d.id, type: 'room', points: P }; return;
    }
    if (d.kind === 'ivertex') {
      // corner of a shaped item: work in its own (rotated) units, then re-fit w × h to the new outline
      const g0 = d.g0, a = (-g0.r * Math.PI) / 180, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      const P = moveCorner(d.pts0, d.v, s(d.pts0[d.v][0] + lx, 1), s(d.pts0[d.v][1] + ly, 1)), b = bbox(P);
      if (b.w < 2 || b.h < 2) return;
      const points = P.map(([x, y]) => [r2(x - b.x), r2(y - b.y)] as Pt);
      // it rotates about its centre, which moves with the box: shift x/y so untouched corners stay put on the plan
      const rr = (g0.r * Math.PI) / 180, cos = Math.cos(rr), sin = Math.sin(rr), ox = b.x + b.w / 2 - g0.w / 2, oy = b.y + b.h / 2 - g0.h / 2;
      const g = { x: g0.x + g0.w / 2 - b.w / 2 + cos * ox - sin * oy, y: g0.y + g0.h / 2 - b.h / 2 + sin * ox + cos * oy, w: b.w, h: b.h, r: g0.r };
      setItem(d.id, g, points); last.current = { id: d.id, type: 'item', x: r2(g.x), y: r2(g.y), w: r2(g.w), h: r2(g.h), r: g.r, points }; return;
    }
    const g0 = d.g0, g = { ...g0 };
    if (d.kind === 'move') { g.x = s(g0.x + dx); g.y = s(g0.y + dy); }
    else if (d.kind === 'rot') {
      const cx = g0.x + g0.w / 2, cy = g0.y + g0.h / 2;
      g.r = ((Math.round(((Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90) / 15) * 15) % 360 + 360) % 360;
    } else if (d.kind === 'size') {
      const a = (-g0.r * Math.PI) / 180, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      const east = d.corner.includes('e'), south = d.corner.includes('s');
      g.w = Math.max(2, s(g0.w + (east ? lx : -lx), 1)); g.h = Math.max(2, s(g0.h + (south ? ly : -ly), 1));
      // keep the opposite corner where it was
      const rr = (g0.r * Math.PI) / 180, cos = Math.cos(rr), sin = Math.sin(rr);
      const ou = east ? 0 : g0.w, ov = south ? 0 : g0.h;
      const wx = g0.x + g0.w / 2 + cos * (ou - g0.w / 2) - sin * (ov - g0.h / 2), wy = g0.y + g0.h / 2 + sin * (ou - g0.w / 2) + cos * (ov - g0.h / 2);
      const nu = east ? 0 : g.w, nv = south ? 0 : g.h;
      g.x = wx - (cos * (nu - g.w / 2) - sin * (nv - g.h / 2)) - g.w / 2; g.y = wy - (sin * (nu - g.w / 2) + cos * (nv - g.h / 2)) - g.h / 2;
    }
    setItem(d.id, g); last.current = { id: d.id, type: 'item', x: r2(g.x), y: r2(g.y), w: r2(g.w), h: r2(g.h), r: g.r };
  };
  const onUp = (e: RPointerEvent) => {
    gestureEnd(e);
    if (!drag.current) return;
    drag.current = null; swallow.current = true;
    if (last.current) onChange?.(last.current);
  };
  const addStep = (room: PlanRoom, i: number) => {
    const p = withStep(roomPoints(room), i);
    setRoom(room.id, p); onChange?.({ id: room.id, type: 'room', points: p }); swallow.current = true;
  };
  const addItemStep = (it: PlanItem, i: number) => {
    const g = itemGeo(it), p = withStep(itemPts(it), i);
    setItem(it.id, g, p); onChange?.({ id: it.id, type: 'item', x: g.x, y: g.y, w: g.w, h: g.h, r: g.r, points: p }); swallow.current = true;
  };
  /** "+" on each edge (adds a step) and a square on each corner (drag to reshape). Shared by rooms and shaped items. */
  const shapeHandles = (p: Pt[], onAdd: (i: number) => void, onCorner: (e: RPointerEvent, i: number) => void) => <>
    {p.map((q, i) => { const n = p[(i + 1) % p.length]; if (q[0] === n[0] && q[1] === n[1]) return null; const mx = (q[0] + n[0]) / 2, my = (q[1] + n[1]) / 2;
      return <g key={'a' + i} onPointerDown={(e) => { e.stopPropagation(); onAdd(i); }}><title>Add a step to this edge</title><circle cx={mx} cy={my} r={1.25} className="nk-fp-sel__add" /><path d={`M${mx - 0.6} ${my} H${mx + 0.6} M${mx} ${my - 0.6} V${my + 0.6}`} className="nk-fp-sel__add-plus" /></g>; })}
    {p.map((q, i) => <rect key={'v' + i} x={q[0] - 1.15} y={q[1] - 1.15} width={2.3} height={2.3} rx={0.5} className="nk-fp-sel__vertex" onPointerDown={(e) => onCorner(e, i)} />)}
  </>;

  const onClick = (e: RMouseEvent<SVGSVGElement>) => {
    if (swallow.current) { swallow.current = false; return; }
    const t = (e.target as Element).closest('[data-nk-target]') as SVGGElement | null;
    if (edit && armedKind) { const p = pt(e); onPlace?.({ kind: armedKind, x: s(p.x), y: s(p.y), roomId: t?.dataset.type === 'room' ? t.dataset.id! : null }); return; }
    if (!t) { setSel(null); return; }
    const id = t.dataset.id!;
    setSel(id === sel && !edit ? null : id);
  };

  const rooms = draft.rooms, items = draft.items;
  const solid = items.filter((it) => !KINDS[it.kind]?.wall).sort((p, q) => +(p.kind !== 'rug') - +(q.kind !== 'rug')), walls = items.filter((it) => KINDS[it.kind]?.wall);
  const lvlOf = (h?: number) => (heat ? h ?? 0 : 0);

  const itemNode = (it: PlanItem) => {
    const k = KINDS[it.kind]; if (!k) return null;
    const g = itemGeo(it), lvl = lvlOf(it.heat), isSel = sel === it.id;
    const hatch = lvl >= 3 ? <rect x={-1.2} y={-1.2} width={g.w + 2.4} height={g.h + 2.4} rx={1.8} fill={url(lvl >= 4 ? 'hatch4' : 'hatch')} /> : null;
    return (
      <g key={it.id} data-nk-target="" data-id={it.id} data-type="item" tabIndex={0} aria-label={`${it.name ?? k.label}${lvl ? ', ' + HEAT_WORDS[lvl] : ''}`}
        className={cx('nk-fp-item', lvl >= 4 && 'is-breathing')} transform={`translate(${g.x} ${g.y}) rotate(${g.r} ${g.w / 2} ${g.h / 2})`}
        onPointerDown={edit && isSel ? (e) => begin(e, { kind: 'move', id: it.id, g0: g, p0: pt(e) }) : undefined}
        onKeyDown={(e) => { if (e.key === 'Enter') setSel(it.id); }}>
        {it.kind === 'closet' ? (
          <>{closetBody(g.w, g.h)}{lvl > 0 && <rect width={g.w} height={g.h} className={`nk-fp-tint nk-fp-tint--${lvl}`} />}{lvl >= 3 && <rect width={g.w} height={g.h} fill={url(lvl >= 4 ? 'hatch4' : 'hatch')} />}{closetFront(g.w, g.h, it.door)}</>
        ) : (
          <>{lvl > 0 && (it.points
            ? <path d={pathD(it.points)} className={`nk-fp-halo nk-fp-tint--${lvl}`} style={{ stroke: `var(--heat-${Math.min(lvl, 3)})`, strokeWidth: 2.4, strokeLinejoin: 'round' }} />
            : <rect x={-1.2} y={-1.2} width={g.w + 2.4} height={g.h + 2.4} rx={1.8} className={`nk-fp-halo nk-fp-tint--${lvl}`} />)}{it.points ? null : hatch}{k.draw(g.w, g.h, it.points)}{it.points && lvl >= 3 && <path d={pathD(it.points)} fill={url(lvl >= 4 ? 'hatch4' : 'hatch')} pointerEvents="none" />}</>
        )}
      </g>
    );
  };

  // selection overlay
  let overlay: ReactNode = null;
  const selItem = items.find((it) => it.id === sel), selRoom = rooms.find((r) => r.id === sel);
  const dim = (cx: number, cy: number, w: number, h: number) => (
    <g transform={`translate(${cx} ${cy})`} pointerEvents="none"><rect x={-7} y={-2} width={14} height={3.6} rx={1.8} className="nk-fp-sel__dimbg" /><text y={0.75} textAnchor="middle" className="nk-fp-sel__dim">{h ? `${(w / 10).toFixed(1)} × ${(h / 10).toFixed(1)} m` : `${(w / 10).toFixed(1)} m wide`}</text></g>
  );
  if (selItem && KINDS[selItem.kind]?.wall) {
    const g = itemGeo(selItem);
    overlay = (
      <g transform={`translate(${g.x} ${g.y}) rotate(${g.r})`} pointerEvents="none">
        <rect x={-0.8} y={-1.8} width={g.w + 1.6} height={3.6} rx={edit ? 0 : 1.8} className="nk-fp-sel__halo" />
        <rect x={-0.8} y={-1.8} width={g.w + 1.6} height={3.6} rx={edit ? 0 : 1.8} className={edit ? 'nk-fp-sel__box' : 'nk-fp-sel__ring'} />
        {edit && <g transform={`rotate(${-g.r} ${g.w / 2} 0)`}>{dim(g.w / 2, 5, g.w, 0)}</g>}
      </g>
    );
  } else if (selItem && edit && KINDS[selItem.kind]?.shapeable) {
    const g = itemGeo(selItem), p = itemPts(selItem), d = pathD(p);
    overlay = (
      <g transform={`translate(${g.x} ${g.y}) rotate(${g.r} ${g.w / 2} ${g.h / 2})`}>
        <path d={d} className="nk-fp-sel__halo" pointerEvents="none" />
        <path d={d} className="nk-fp-sel__box" pointerEvents="none" />
        <line x1={g.w / 2} y1={0} x2={g.w / 2} y2={-4.5} className="nk-fp-sel__stem" />
        <circle cx={g.w / 2} cy={-5.3} r={1.4} className="nk-fp-sel__rot" onPointerDown={(e) => begin(e, { kind: 'rot', id: selItem.id, g0: g, p0: pt(e) })} />
        {shapeHandles(p, (i) => addItemStep(selItem, i), (e, i) => begin(e, { kind: 'ivertex', id: selItem.id, v: i, pts0: p, g0: g, p0: pt(e) }))}
        {dim(g.w / 2, g.h + 4.8, g.w, g.h)}
      </g>
    );
  } else if (selItem) {
    const g = itemGeo(selItem), m = edit ? 0.8 : 1.4;
    overlay = (
      <g transform={`translate(${g.x} ${g.y}) rotate(${g.r} ${g.w / 2} ${g.h / 2})`}>
        <rect x={-m} y={-m} width={g.w + 2 * m} height={g.h + 2 * m} rx={edit ? 0 : 2} className="nk-fp-sel__halo" pointerEvents="none" />
        <rect x={-m} y={-m} width={g.w + 2 * m} height={g.h + 2 * m} rx={edit ? 0 : 2} className={edit ? 'nk-fp-sel__box' : 'nk-fp-sel__ring'} pointerEvents="none" />
        {edit && <>
          <line x1={g.w / 2} y1={-m} x2={g.w / 2} y2={-4.5} className="nk-fp-sel__stem" />
          <circle cx={g.w / 2} cy={-5.3} r={1.4} className="nk-fp-sel__rot" onPointerDown={(e) => begin(e, { kind: 'rot', id: selItem.id, g0: g, p0: pt(e) })} />
          {([[-m, -m, 'nw'], [g.w + m, -m, 'ne'], [-m, g.h + m, 'sw'], [g.w + m, g.h + m, 'se']] as const).map(([x, y, c]) => (
            <circle key={c} cx={x} cy={y} r={1.3} className="nk-fp-sel__handle" onPointerDown={(e) => begin(e, { kind: 'size', corner: c, id: selItem.id, g0: g, p0: pt(e) })} />
          ))}
          {dim(g.w / 2, g.h + 4.8, g.w, g.h)}
        </>}
      </g>
    );
  } else if (selRoom) {
    const p = roomPoints(selRoom), d = pathD(p), b = bbox(p);
    overlay = (
      <g>
        <path d={d} className="nk-fp-sel__halo" pointerEvents="none" />
        <path d={d} className={edit ? 'nk-fp-sel__box' : 'nk-fp-sel__ring'} pointerEvents="none" />
        {edit && <>
          {shapeHandles(p, (i) => addStep(selRoom, i), (e, i) => begin(e, { kind: 'vertex', id: selRoom.id, v: i, pts0: p, p0: pt(e) }))}
          {dim(b.x + b.w / 2, b.y + b.h + 4.8, b.w, b.h)}
        </>}
      </g>
    );
  }

  return (
    <div ref={boxRef} className={cx('nk-fp', `nk-fp--${mode}`, className)} style={style}>
      <svg ref={svgRef} viewBox={`${zx} ${zy} ${zw} ${zh}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}
        onClick={onClick} onPointerDownCapture={onDownCapture} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <defs>
          <pattern id={`${uid}-wood`} width={24} height={6} patternUnits="userSpaceOnUse"><rect width={24} height={6} className="nk-fp-wood" /><line x1={0} y1={3} x2={24} y2={3} className="nk-fp-wood-line" /><line x1={0} y1={6} x2={24} y2={6} className="nk-fp-wood-line" /><line x1={8} y1={0} x2={8} y2={3} className="nk-fp-wood-line" /><line x1={20} y1={3} x2={20} y2={6} className="nk-fp-wood-line" /></pattern>
          <pattern id={`${uid}-vinyl`} width={36} height={5.4} patternUnits="userSpaceOnUse"><rect width={36} height={5.4} className="nk-fp-vinyl" /><line x1={0} y1={1.8} x2={36} y2={1.8} className="nk-fp-vinyl-line" /><line x1={0} y1={3.6} x2={36} y2={3.6} className="nk-fp-vinyl-line" /><line x1={0} y1={5.4} x2={36} y2={5.4} className="nk-fp-vinyl-line" /><line x1={4} y1={0} x2={4} y2={1.8} className="nk-fp-vinyl-line" /><line x1={16} y1={1.8} x2={16} y2={3.6} className="nk-fp-vinyl-line" /><line x1={28} y1={3.6} x2={28} y2={5.4} className="nk-fp-vinyl-line" /></pattern>
          <pattern id={`${uid}-tile`} width={5} height={5} patternUnits="userSpaceOnUse"><rect width={5} height={5} className="nk-fp-tile" /><line x1={0} y1={0} x2={5} y2={0} className="nk-fp-tile-line" /><line x1={0} y1={0} x2={0} y2={5} className="nk-fp-tile-line" /></pattern>
          <pattern id={`${uid}-carpet`} width={2} height={2} patternUnits="userSpaceOnUse"><rect width={2} height={2} className="nk-fp-carpet" /><circle cx={0.5} cy={0.5} r={0.28} className="nk-fp-carpet-dot" /><circle cx={1.5} cy={1.5} r={0.28} className="nk-fp-carpet-dot" /></pattern>
          <pattern id={`${uid}-concrete`} width={7} height={7} patternUnits="userSpaceOnUse"><rect width={7} height={7} className="nk-fp-concrete" /><circle cx={1.2} cy={2} r={0.3} className="nk-fp-concrete-dot" /><circle cx={4.6} cy={0.8} r={0.22} className="nk-fp-concrete-dot" /><circle cx={5.4} cy={4.9} r={0.32} className="nk-fp-concrete-dot" /><circle cx={2.4} cy={5.6} r={0.2} className="nk-fp-concrete-dot" /></pattern>
          <pattern id={`${uid}-hatch`} width={2.6} height={2.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={2.6} className="nk-fp-hatch" /></pattern>
          <pattern id={`${uid}-hatch4`} width={2.2} height={2.2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={2.2} className="nk-fp-hatch nk-fp-hatch--4" /></pattern>
          <pattern id={`${uid}-grid`} width={10} height={10} patternUnits="userSpaceOnUse"><line x1={5} y1={0} x2={5} y2={10} className="nk-fp-grid" /><line x1={0} y1={5} x2={10} y2={5} className="nk-fp-grid" /><line x1={0} y1={0} x2={10} y2={0} className="nk-fp-grid-major" /><line x1={0} y1={0} x2={0} y2={10} className="nk-fp-grid-major" /></pattern>
        </defs>
        {edit && <rect x={vx} y={vy} width={vw} height={vh} fill={url('grid')} />}

        {rooms.map((rm) => {
          const d = pathD(roomPoints(rm)), lvl = lvlOf(rm.heat);
          return (
            <g key={rm.id} data-nk-target="" data-id={rm.id} data-type="room" className="nk-fp-room" tabIndex={0} aria-label={`${rm.name}${lvl ? ', ' + HEAT_WORDS[lvl] : ''}`} onKeyDown={(e) => { if (e.key === 'Enter') setSel(rm.id); }}>
              <path d={d} fill={url(rm.floor)} />
              {lvl > 0 && <path d={d} className={`nk-fp-tint nk-fp-tint--${lvl}`} />}
              {lvl >= 3 && <path d={d} fill={url(lvl >= 4 ? 'hatch4' : 'hatch')} />}
            </g>
          );
        })}
        {solid.map(itemNode)}
        {rooms.map((rm) => <path key={'w' + rm.id} d={pathD(roomPoints(rm))} className="nk-fp-wall" />)}
        {draft.outline && <path d={pathD(draft.outline)} className="nk-fp-outline" />}
        {walls.map((it) => {
          const k = KINDS[it.kind], g = itemGeo(it), lvl = k.chores ? lvlOf(it.heat) : 0;
          // in edit mode every wall piece can be picked; on the heat map only the ones that take chores (windows)
          const tappable = edit || (heat && k.chores);
          const tap = tappable ? { 'data-nk-target': '', 'data-id': it.id, 'data-type': 'item', tabIndex: 0, 'aria-label': `${it.name ?? k.label}${lvl ? ', ' + HEAT_WORDS[lvl] : ''}`,
            onKeyDown: (e: RKeyboardEvent) => { if (e.key === 'Enter') setSel(it.id); } } : {};
          return (
            <g key={it.id} {...tap} className={cx('nk-fp-wallpiece', lvl >= 4 && 'is-breathing')} transform={`translate(${it.x} ${it.y}) rotate(${g.r})${it.flip ? ' scale(1 -1)' : ''}`}
              onPointerDown={edit && sel === it.id ? (e) => begin(e, { kind: 'move', id: it.id, g0: g, p0: pt(e) }) : undefined}>
              {tappable && <rect x={-0.5} y={-2} width={g.w + 1} height={4} fill="transparent" />}
              {lvl > 0 && <rect x={-0.8} y={-1.8} width={g.w + 1.6} height={3.6} rx={1.8} className={`nk-fp-halo nk-fp-tint--${lvl}`} />}
              {k.draw(g.w, g.h)}
            </g>
          );
        })}

        {heat && solid.map((it) => {
          const lvl = it.heat ?? 0; if (!lvl) return null;
          const g = itemGeo(it), [ew, eh] = extent(g), cx = g.x + g.w / 2, cy = g.y + g.h / 2;
          return (
            <g key={'pin' + it.id} pointerEvents="none">
              {lvl >= 3 && <g className={`nk-fp-pin nk-fp-pin--${lvl}`} transform={`translate(${cx + ew + 0.4} ${cy - eh - 0.4})`}><circle r={2.2} /><text y={0.95} textAnchor="middle">!</text></g>}
              {(it.count ?? 0) > 1 && <g className="nk-fp-count" transform={`translate(${cx - ew - 0.4} ${cy - eh - 0.4})`}><circle r={2.1} /><text y={0.85} textAnchor="middle">{it.count}</text></g>}
            </g>
          );
        })}
        {heat && walls.map((it) => {
          const lvl = KINDS[it.kind]?.chores ? it.heat ?? 0 : 0; if (!lvl) return null;
          const g = itemGeo(it), a = (g.r * Math.PI) / 180, cx = it.x + (g.w / 2) * Math.cos(a), cy = it.y + (g.w / 2) * Math.sin(a);
          return (
            <g key={'pin' + it.id} pointerEvents="none">
              {lvl >= 3 && <g className={`nk-fp-pin nk-fp-pin--${lvl}`} transform={`translate(${cx + 2.6} ${cy - 2.6})`}><circle r={2.2} /><text y={0.95} textAnchor="middle">!</text></g>}
              {(it.count ?? 0) > 1 && <g className="nk-fp-count" transform={`translate(${cx - 2.6} ${cy - 2.6})`}><circle r={2.1} /><text y={0.85} textAnchor="middle">{it.count}</text></g>}
            </g>
          );
        })}

        {showLabels && rooms.map((rm) => {
          const b = bbox(roomPoints(rm)), [lx, ly] = rm.labelAt ?? [b.x + b.w / 2, b.y + b.h / 2], lvl = lvlOf(rm.heat);
          return (
            <g key={'l' + rm.id} className="nk-fp-label" pointerEvents="none">
              <text x={lx} y={ly} textAnchor="middle" className="nk-fp-label__name">{rm.name.toUpperCase()}</text>
              {lvl > 0 && rm.chore && <text x={lx} y={ly + 3} textAnchor="middle" className="nk-fp-label__chore">{rm.chore}</text>}
            </g>
          );
        })}
        {overlay}
      </svg>
      {view.z > 1.01 && <button type="button" className="nk-fp-zoom" onClick={() => setView({ z: 1, cx: 0, cy: 0 })}>{Math.round(view.z * 100)}% · Reset zoom</button>}
    </div>
  );
}

export type { ItemKind };
