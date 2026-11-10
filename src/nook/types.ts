/** 0 fresh · 1 due soon · 2 due now · 3 overdue · 4 way overdue */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;
/** a = Frank (green), b = Sarah (pink), home = the household / shared */
export type Person = 'a' | 'b' | 'home';
export type Floor = 'wood' | 'vinyl' | 'tile' | 'carpet' | 'concrete';
export type Pt = [number, number];

export type ItemKind =
  | 'bed' | 'sofa' | 'armchair' | 'table' | 'roundtable' | 'chair' | 'desk' | 'nightstand' | 'wardrobe' | 'shelf' | 'tv'
  | 'rug' | 'plant' | 'flowers'
  | 'counter' | 'fridge' | 'stove' | 'sink' | 'dishwasher' | 'pantry' | 'coffee' | 'washer' | 'dryer' | 'washdry' | 'trash' | 'toilet' | 'tub' | 'shower'
  | 'closet' | 'door' | 'slider' | 'opening' | 'window';

/** Plan units are decimetres: 10 = 1 m. Rooms are right-angled polygons (rectangles, L-shapes, …). */
export interface PlanRoom {
  id: string;
  name: string;
  floor: Floor;
  /** Corners in order. Every edge must be horizontal or vertical. Or use x/y/w/h for a rectangle. */
  points?: Pt[];
  x?: number; y?: number; w?: number; h?: number;
  /** Filled by applyHeat(): hottest chore on this floor. */
  heat?: HeatLevel;
  /** Filled by applyHeat(): one line under the label, e.g. "Vacuum · 4d late". */
  chore?: string;
  labelAt?: Pt;
}

export interface PlanItem {
  id: string;
  kind: ItemKind;
  x: number; y: number;
  w?: number; h?: number;
  /** Degrees. Furniture rotates about its centre; doors, sliders, openings and windows about (x, y). */
  r?: number;
  /** Doors: mirror the swing to the other side of the wall. */
  flip?: boolean;
  /** Sofas: corners in local units within w × h, every edge horizontal or vertical (an L or U sectional). Absent = rectangle. */
  points?: Pt[];
  /** Closets: door style on the open (bottom) edge. */
  door?: 'sliding' | 'hinged' | 'none';
  name?: string;
  /** Filled by applyHeat(). */
  heat?: HeatLevel;
  /** Filled by applyHeat(): how many chores are due on this item (shows a bubble when > 1). */
  count?: number;
}

export interface Plan {
  width: number;
  height: number;
  /** Apartment outline, drawn as the thick outer wall. */
  outline?: Pt[];
  rooms: PlanRoom[];
  items: PlanItem[];
}

export type PlanChange =
  | { id: string; type: 'item'; x: number; y: number; w: number; h: number; r: number; points?: Pt[] }
  | { id: string; type: 'room'; points: Pt[] };

/** A chore row, shaped like the `chores` table in the Supabase guide. */
export interface Chore {
  id: string;
  title: string;
  /** Room id or item id in the plan this chore lives on. */
  target_id: string;
  icon?: string | null;
  /** Time-based: due every N days. */
  interval_days?: number | null;
  /** Use-based: due after N uses (1 = after each use). */
  use_limit?: number | null;
  uses?: number | null;
  last_done_at?: string | null;
  snoozed_until?: string | null;
}
