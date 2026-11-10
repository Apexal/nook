import type { Chore, HeatLevel, Plan } from './types';

export const HEAT_WORDS = ['Fresh', 'Due soon', 'Due now', 'Overdue', 'Way overdue'] as const;

const DAY = 86400000;

/**
 * Heat for one chore. Time-based (intervalDays), use-based (useLimit: after N uses,
 * 1 = after each use), or both, in which case the hotter of the two wins.
 */
export function heatLevel(o: {
  now?: Date; lastDone?: Date | string | null; intervalDays?: number | null;
  uses?: number | null; useLimit?: number | null; snoozedUntil?: Date | string | null;
}): HeatLevel {
  const now = o.now ?? new Date();
  if (o.snoozedUntil && new Date(o.snoozedUntil) > now) return 0;
  let lvl = 0;
  if (o.intervalDays) {
    if (!o.lastDone) lvl = 2; // never done (e.g. just added): due now
    else {
      const elapsed = (now.getTime() - new Date(o.lastDone).getTime()) / DAY;
      const i = o.intervalDays, grace = Math.min(Math.max(i * 0.2, 0.5), 3);
      lvl = elapsed >= i * 2 ? 4 : elapsed >= i + 1 ? 3 : elapsed >= i ? 2 : elapsed >= i - grace ? 1 : 0;
    }
  }
  if (o.useLimit) {
    const u = o.uses ?? 0, n = o.useLimit;
    const ul = n === 1 ? (u === 0 ? 0 : u === 1 ? 2 : u === 2 ? 3 : 4)
      : u >= n * 2 ? 4 : u > n ? 3 : u === n ? 2 : u >= Math.min(n - 1, Math.ceil(n * 0.8)) ? 1 : 0;
    lvl = Math.max(lvl, ul);
  }
  return lvl as HeatLevel;
}

export function choreHeat(c: Chore, now = new Date()): HeatLevel {
  return heatLevel({ now, lastDone: c.last_done_at, intervalDays: c.interval_days, uses: c.uses, useLimit: c.use_limit, snoozedUntil: c.snoozed_until });
}

/** Days past due for a time-based chore (0 if not late). */
export function daysLate(c: Chore, now = new Date()): number {
  if (!c.interval_days || !c.last_done_at) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(c.last_done_at).getTime()) / DAY - c.interval_days));
}

/** Badge text: "Overdue · 4d", "Due now", "24 of 30 uses"… */
export function heatLabel(c: Chore, now = new Date()): string {
  const l = choreHeat(c, now), late = daysLate(c, now);
  return l >= 3 && late ? `${HEAT_WORDS[l]} · ${late}d` : HEAT_WORDS[l];
}

/**
 * Paint a plan with chore heat: each room/item gets the level of its hottest chore,
 * rooms get a one-line summary, items get a count of chores that need attention.
 */
export function applyHeat(plan: Plan, chores: Chore[], now = new Date()): Plan {
  const by = new Map<string, Chore[]>();
  for (const c of chores) { const a = by.get(c.target_id) ?? []; a.push(c); by.set(c.target_id, a); }
  const hottest = (id: string) => {
    const list = (by.get(id) ?? []).map((c) => ({ c, l: choreHeat(c, now) })).sort((a, b) => b.l - a.l);
    return { top: list[0], due: list.filter((x) => x.l > 0).length };
  };
  return {
    ...plan,
    rooms: plan.rooms.map((r) => {
      const { top, due } = hottest(r.id);
      if (!top || top.l === 0) return { ...r, heat: 0, chore: undefined };
      const late = daysLate(top.c, now);
      const what = top.c.title.split(' ')[0];
      const when = top.l >= 3 && late ? `${late}d late` : HEAT_WORDS[top.l].toLowerCase();
      return { ...r, heat: top.l, chore: `${what} · ${when}${due > 1 ? ` · +${due - 1}` : ''}` };
    }),
    items: plan.items.map((it) => {
      const { top, due } = hottest(it.id);
      return { ...it, heat: top ? top.l : 0, count: due };
    }),
  };
}
