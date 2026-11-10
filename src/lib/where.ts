import { itemKinds, roomPoints, takesChores, type Chore, type Plan, type PlanItem, type PlanRoom, type Pt, type SelectOption } from '../nook';

function inside(pt: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Distance from a point to a polygon's outline. */
function distTo(pt: Pt, poly: Pt[]) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy)));
  }
  return best;
}

export const itemName = (it: PlanItem) => it.name || itemKinds[it.kind]?.label || it.kind;

/** The room a room-or-item id belongs to. Items outside every room (closets in a wall, a walk-in drawn as its own space) belong to the nearest one. */
export function roomOf(plan: Plan, id: string): PlanRoom | null {
  const r = plan.rooms.find((x) => x.id === id);
  if (r) return r;
  const it = plan.items.find((x) => x.id === id);
  if (!it) return null;
  const k = itemKinds[it.kind], w = it.w ?? k.w;
  // wall pieces (windows) rotate about (x, y), so their middle is along the rotated width; the rest rotate about their centre
  const a = ((it.r ?? 0) * Math.PI) / 180;
  const c: Pt = k.wall ? [it.x + (w / 2) * Math.cos(a), it.y + (w / 2) * Math.sin(a)] : [it.x + w / 2, it.y + (it.h ?? k.h) / 2];
  const hit = plan.rooms.find((x) => inside(c, roomPoints(x)));
  if (hit) return hit;
  let near: PlanRoom | null = null, d = Infinity;
  for (const x of plan.rooms) { const e = distTo(c, roomPoints(x)); if (e < d) { d = e; near = x; } }
  return near;
}

/** "Kitchen · Fridge", or just "Master bedroom" for a floor. */
export function targetName(plan: Plan, id: string): string {
  const r = plan.rooms.find((x) => x.id === id);
  if (r) return r.name;
  const it = plan.items.find((x) => x.id === id);
  if (!it) return 'Somewhere';
  const room = roomOf(plan, id);
  return room ? `${room.name} · ${itemName(it)}` : itemName(it);
}

/** Every place a chore can live: each room's floor, then the things in it. */
export function targetOptions(plan: Plan): SelectOption[] {
  const out: SelectOption[] = [];
  const things = plan.items.filter((it) => takesChores(it.kind)).map((it) => ({ it, room: roomOf(plan, it.id) }));
  for (const r of plan.rooms) {
    out.push({ value: r.id, label: r.name, description: 'Floor', material: r.floor });
    for (const { it, room } of things) if (room?.id === r.id) out.push({ value: it.id, label: `${r.name} · ${itemName(it)}`, icon: 'dot' });
  }
  // only when the plan has no rooms yet: still offer every item
  for (const { it, room } of things) if (!room) out.push({ value: it.id, label: itemName(it), icon: 'dot' });
  return out;
}

export function scheduleText(c: Pick<Chore, 'interval_days' | 'use_limit'>): string {
  const parts: string[] = [];
  if (c.use_limit) parts.push(c.use_limit === 1 ? 'after each use' : `every ${c.use_limit} uses`);
  if (c.interval_days) {
    const d = Number(c.interval_days);
    parts.push(d === 1 ? 'every day' : d % 30 === 0 ? (d === 30 ? 'every month' : `every ${d / 30} months`) : d % 7 === 0 ? (d === 7 ? 'every week' : `every ${d / 7} weeks`) : `every ${d} days`);
  }
  const s = parts.join(' or ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Whole calendar days from `a` to `b`, on this device's clock (so 23:00 → 08:00 next morning is 1). */
function calendarDays(a: Date, b: Date) {
  const noon = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x.getTime(); };
  return Math.round((noon(b) - noon(a)) / 86400000);
}

export function agoText(iso?: string | null): string {
  if (!iso) return 'never';
  const days = calendarDays(new Date(iso), new Date());
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export function dueText(due?: string | null): { text?: string; late: boolean } {
  if (!due) return { late: false };
  const d = new Date(due + 'T12:00:00'), n = calendarDays(new Date(), d);
  if (n < 0) return { text: `Overdue · ${-n}d`, late: true };
  if (n === 0) return { text: 'Today', late: false };
  if (n === 1) return { text: 'Tomorrow', late: false };
  if (n < 7) return { text: d.toLocaleDateString(undefined, { weekday: 'long' }), late: false };
  return { text: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), late: false };
}
