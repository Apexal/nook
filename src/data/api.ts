import type { Chore, Plan } from '../nook';

export type PersonKey = 'a' | 'b';

export interface Category { id: string; name: string; icon: string; sort: number }
export interface Task {
  id: string; title: string; notes?: string | null; due_on?: string | null; done_at?: string | null;
  category_id?: string | null; owner?: string | null; created_at?: string;
}
export interface ShoppingItem { id: string; name: string; qty: number; bought_at?: string | null; cleared_at?: string | null; created_at?: string }
export interface Member { user_id: string; person: PersonKey | null; name: string }
export type PrivateTaskDraft = { id?: string; title: string; done: boolean; due_on?: string | null };

export interface Snapshot {
  plan: Plan;
  chores: Chore[];
  categories: Category[];
  /** Shared tasks only. */
  tasks: Task[];
  /** The signed-in person's own private tasks (phones). Empty on the tablet, which reads private lists with the PIN. */
  myTasks: Task[];
  shopping: ShoppingItem[];
  usuals: string[];
  members: Member[];
  /** Who is signed in on this device. `person` is null for the shared tablet (and in demo mode). */
  me: Member | null;
}

/** A chore to save. Without an id it is inserted; `last_done_at`, `uses` and `snoozed_until` are kept when given (undo of a delete). */
export type ChoreDraft = Omit<Chore, 'id'> & { id?: string };

/** Everything the screens need from a backend. Implemented by Supabase and by the local demo. */
export interface Api {
  mode: 'demo' | 'supabase';
  load(): Promise<Snapshot>;
  /** Called whenever data changes elsewhere (the other person's phone, another tab). */
  subscribe(onChange: () => void): () => void;

  completeChore(id: string): Promise<void>;
  /** Snooze until `until` (ISO), normally 06:00 tomorrow on this device's clock. */
  snoozeChore(id: string, until: string): Promise<void>;
  logUse(id: string): Promise<void>;
  /** Undo: put back a chore row as it was before an action. */
  restoreChore(c: Chore): Promise<void>;
  saveChore(c: ChoreDraft): Promise<void>;
  deleteChore(id: string): Promise<void>;

  /** Save the plan, then delete the chores that lived on rooms or items it no longer has. */
  savePlan(plan: Plan, removedTargets: string[]): Promise<void>;

  addCategory(name: string, icon: string): Promise<void>;
  updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'icon'>>): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  addTask(categoryId: string, title: string): Promise<void>;
  setTaskDone(id: string, done: boolean): Promise<void>;

  addShopping(name: string, qty?: number): Promise<void>;
  setBought(id: string, bought: boolean): Promise<void>;
  setQty(id: string, qty: number): Promise<void>;
  clearBought(): Promise<void>;

  /** Tablet: is this the household PIN? Throws "too many tries" while locked out. */
  checkPin(pin: string): Promise<boolean>;
  /** Tablet: one person's private list, read with the household PIN. */
  privateTasks(person: PersonKey, pin: string): Promise<Task[]>;
  /** Tablet: add or update a private task with the household PIN. Throws on a wrong PIN. */
  savePrivateTask(person: PersonKey, pin: string, t: PrivateTaskDraft): Promise<void>;
  /** Phone: add or update the signed-in person's own private task (row-level security, no PIN). */
  saveMyTask(t: PrivateTaskDraft): Promise<void>;
}
