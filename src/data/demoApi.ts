import { samplePlan, sampleChores, type Chore, type Plan } from '../nook';
import type { Api, Category, PersonKey, ShoppingItem, Snapshot, Task } from './api';

/** Demo mode: the sample apartment, kept in this browser's localStorage. PIN for both lists: 1234. */
const KEY = 'nook-demo-v1';
const DEMO_PIN = '1234';

interface DemoState {
  plan: Plan; chores: Chore[]; categories: Category[]; tasks: Task[]; shopping: ShoppingItem[];
  history: string[]; private: Record<PersonKey, Task[]>;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const iso = (d = new Date()) => d.toISOString();
const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function fresh(): DemoState {
  const cat = (name: string, icon: string, sort: number): Category => ({ id: uid(), name, icon, sort });
  const admin = cat('Home admin', 'folder', 0), trip = cat('Lisbon trip', 'tag', 1), garden = cat('Balcony garden', 'leaf', 2);
  const t = (category_id: string, title: string, due?: number, done = false): Task =>
    ({ id: uid(), title, category_id, due_on: due == null ? null : daysFromNow(due), done_at: done ? iso() : null, created_at: iso() });
  const p = (title: string, due?: number): Task => ({ id: uid(), title, due_on: due == null ? null : daysFromNow(due), done_at: null, created_at: iso() });
  return {
    plan: samplePlan,
    chores: sampleChores(),
    categories: [admin, trip, garden],
    tasks: [t(admin.id, 'Renew renters insurance', -2), t(admin.id, 'Book chimney sweep'), t(admin.id, 'Pay council tax', 4),
      t(trip.id, 'Book the hotel', 4), t(trip.id, 'Ask Ana about the cat'), t(trip.id, 'Book flights', undefined, true),
      t(garden.id, 'Repot the herbs'), t(garden.id, 'Buy compost')],
    shopping: [['Oat milk', 2], ['Eggs', 1], ['Basil plant', 1], ['Dish soap', 1], ['Lemons', 4]].map(([name, qty]) => ({ id: uid(), name: name as string, qty: qty as number, created_at: iso() })),
    history: ['Bread', 'Bananas', 'Yoghurt', 'Pasta', 'Tomatoes', 'Cheese', 'Toilet paper'],
    private: { a: [p('Birthday present for Sarah', 11), p('Dentist', 4), p('Renew gym membership')], b: [p('Call mum', 6), p('Pick up prescription'), p('Sign up for pottery class')] },
  };
}

function read(raw: string | null): DemoState | null {
  try { const s = JSON.parse(raw ?? '') as DemoState; return s?.plan ? s : null; } catch { return null; }
}

export function demoApi(): Api {
  let stored: string | null = null;
  try { stored = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  let s: DemoState = read(stored) ?? fresh();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
  const write = async (f: () => void) => { f(); save(); };
  const chore = (id: string, patch: Partial<Chore>) => { s.chores = s.chores.map((c) => (c.id === id ? { ...c, ...patch } : c)); };
  const checkPin = (pin: string) => { if (pin !== DEMO_PIN) throw new Error('wrong pin'); };

  return {
    mode: 'demo',
    async load(): Promise<Snapshot> {
      return {
        plan: s.plan, chores: s.chores, categories: [...s.categories].sort((a, b) => a.sort - b.sort), tasks: s.tasks, myTasks: [],
        shopping: s.shopping.filter((i) => !i.cleared_at), usuals: s.history,
        members: [{ user_id: 'a', person: 'a', name: 'Frank' }, { user_id: 'b', person: 'b', name: 'Sarah' }],
        me: null,
      };
    },
    subscribe(onChange) {
      // another tab changed the demo
      const onStorage = (e: StorageEvent) => {
        if (e.key !== KEY) return;
        const next = read(e.newValue); if (!next) return;
        s = next; onChange();
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },

    completeChore: (id) => write(() => chore(id, { last_done_at: iso(), uses: 0, snoozed_until: null })),
    snoozeChore: (id, until) => write(() => chore(id, { snoozed_until: until })),
    logUse: (id) => write(() => chore(id, { uses: (s.chores.find((c) => c.id === id)?.uses ?? 0) + 1 })),
    restoreChore: (c) => write(() => chore(c.id, { last_done_at: c.last_done_at, uses: c.uses, snoozed_until: c.snoozed_until })),
    saveChore: (c) => write(() => {
      if (c.id) chore(c.id, c);
      else s.chores = [...s.chores, { ...c, id: uid(), uses: c.uses ?? 0, last_done_at: c.last_done_at ?? null, snoozed_until: c.snoozed_until ?? null }];
    }),
    deleteChore: (id) => write(() => { s.chores = s.chores.filter((c) => c.id !== id); }),

    savePlan: (plan, removed) => write(() => { s.plan = plan; s.chores = s.chores.filter((c) => !removed.includes(c.target_id)); }),

    addCategory: (name, icon) => write(() => { s.categories = [...s.categories, { id: uid(), name, icon, sort: Math.max(-1, ...s.categories.map((c) => c.sort)) + 1 }]; }),
    updateCategory: (id, patch) => write(() => { s.categories = s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)); }),
    deleteCategory: (id) => write(() => { s.categories = s.categories.filter((c) => c.id !== id); s.tasks = s.tasks.filter((t) => t.category_id !== id); }),
    addTask: (category_id, title) => write(() => { s.tasks = [...s.tasks, { id: uid(), title, category_id, done_at: null, created_at: iso() }]; }),
    setTaskDone: (id, done) => write(() => { s.tasks = s.tasks.map((t) => (t.id === id ? { ...t, done_at: done ? iso() : null } : t)); }),

    addShopping: (name, qty = 1) => write(() => {
      s.shopping = [...s.shopping, { id: uid(), name, qty, created_at: iso() }];
      if (!s.history.some((h) => h.toLowerCase() === name.toLowerCase())) s.history = [...s.history, name];
    }),
    setBought: (id, bought) => write(() => { s.shopping = s.shopping.map((i) => (i.id === id ? { ...i, bought_at: bought ? iso() : null } : i)); }),
    setQty: (id, qty) => write(() => { s.shopping = s.shopping.map((i) => (i.id === id ? { ...i, qty } : i)); }),
    clearBought: () => write(() => { s.shopping = s.shopping.filter((i) => !i.bought_at); }),

    async checkPin(pin) { return pin === DEMO_PIN; },
    async privateTasks(person, pin) { checkPin(pin); return s.private[person]; },
    savePrivateTask: (person, pin, t) => write(() => {
      checkPin(pin);
      const list = s.private[person];
      const row: Task = { id: t.id ?? uid(), title: t.title, due_on: t.due_on ?? null, done_at: t.done ? iso() : null, created_at: iso() };
      s.private[person] = t.id ? list.map((x) => (x.id === t.id ? { ...x, ...row, created_at: x.created_at } : x)) : [...list, row];
    }),
    async saveMyTask() { throw new Error('The demo runs as the tablet'); },
  };
}

/** Wipe demo data back to the sample apartment. */
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
