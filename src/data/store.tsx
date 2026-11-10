import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Chore, IconName, Plan } from '../nook';
import type { Api, ChoreDraft, PersonKey, PrivateTaskDraft, Snapshot } from './api';

export interface ToastState { id: number; message: string; icon?: IconName; undo?: () => void }

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const nowIso = () => new Date().toISOString();
let tmpN = 0;
/** Placeholder id for a row added optimistically, until the re-read brings the real one. */
const tmpId = () => `tmp-${++tmpN}`;
/** Snoozing puts a chore off until 06:00 tomorrow, on this device's clock. */
export function snoozeUntil(now = new Date()) { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(6, 0, 0, 0); return d.toISOString(); }

function useStoreValue(api: Api) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToastState] = useState<ToastState | null>(null);
  const toastId = useRef(0);
  const setToast = useCallback((t: Omit<ToastState, 'id'> | null) => setToastState(t && { ...t, id: ++toastId.current }), []);

  // One load at a time. Calls that arrive meanwhile ask for one more pass, and a load that started before an
  // optimistic change (gen moved on) is dropped, so a slow response never paints old data over newer state.
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const gen = useRef(0);
  const refresh = useCallback((): Promise<void> => {
    if (inflight.current) { again.current = true; return inflight.current; }
    const loop = async () => {
      do {
        again.current = false;
        const g = gen.current;
        try {
          const d = await api.load();
          if (!again.current && g === gen.current) { setData(d); setError(null); }
        } catch (e) {
          if (!again.current) setError(errText(e));
        }
      } while (again.current);
      inflight.current = null;
    };
    inflight.current = loop();
    return inflight.current;
  }, [api]);

  useEffect(() => {
    refresh();
    const unsubscribe = api.subscribe(refresh);
    // the tablet sleeps and Wi-Fi drops: catch up when it comes back
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => { unsubscribe(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', refresh); };
  }, [api, refresh]);

  /** Apply a change locally right away, then persist it and re-read. Resolves to false (and shows a toast) when saving failed. */
  const run = useCallback(async (optimistic: ((d: Snapshot) => Snapshot) | null, call: () => Promise<void>): Promise<boolean> => {
    if (optimistic) { gen.current++; setData((d) => (d ? optimistic(d) : d)); }
    let ok = true;
    try { await call(); }
    catch (e) { ok = false; setToast({ icon: 'alert', message: `Couldn't save: ${errText(e)}` }); }
    await refresh();
    return ok;
  }, [refresh, setToast]);

  const actions = useMemo(() => {
    const patchChore = (id: string, patch: Partial<Chore>) => (d: Snapshot) => ({ ...d, chores: d.chores.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    const undoTo = (c: Chore) => () => { run(patchChore(c.id, c), () => api.restoreChore(c)); };
    return {
      completeChore(c: Chore) {
        run(patchChore(c.id, { last_done_at: nowIso(), uses: 0, snoozed_until: null }), () => api.completeChore(c.id));
        setToast({ message: `${c.title} · done`, undo: undoTo(c) });
      },
      snoozeChore(c: Chore) {
        const until = snoozeUntil();
        run(patchChore(c.id, { snoozed_until: until }), () => api.snoozeChore(c.id, until));
        setToast({ icon: 'clock', message: 'Snoozed until tomorrow', undo: undoTo(c) });
      },
      logUse(c: Chore) {
        run(patchChore(c.id, { uses: (c.uses ?? 0) + 1 }), () => api.logUse(c.id));
        setToast({ icon: 'tally', message: `${c.title} · +1 use`, undo: undoTo(c) });
      },
      saveChore: (c: ChoreDraft) => run(null, () => api.saveChore(c)),
      deleteChore(c: Chore) {
        run((d) => ({ ...d, chores: d.chores.filter((x) => x.id !== c.id) }), () => api.deleteChore(c.id));
        // put it back as it was, history included, so it doesn't come back as "never done"
        setToast({ icon: 'trash', message: `Deleted “${c.title}”`, undo: () => { run(null, () => api.saveChore({ ...c, id: undefined })); } });
      },
      savePlan: (plan: Plan, removedTargets: string[] = []) =>
        run((d) => ({ ...d, plan, chores: d.chores.filter((c) => !removedTargets.includes(c.target_id)) }), () => api.savePlan(plan, removedTargets)),

      addCategory: (name: string, icon: string) => run(null, () => api.addCategory(name, icon)),
      updateCategory: (id: string, patch: { name?: string; icon?: string }) => run((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), () => api.updateCategory(id, patch)),
      deleteCategory: (id: string) => run((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id) }), () => api.deleteCategory(id)),
      addTask: (categoryId: string, title: string) => run((d) => ({ ...d, tasks: [...d.tasks, { id: tmpId(), title, category_id: categoryId }] }), () => api.addTask(categoryId, title)),
      setTaskDone: (id: string, done: boolean) => run((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done_at: done ? nowIso() : null } : t)) }), () => api.setTaskDone(id, done)),

      addShopping: (name: string) => run((d) => ({ ...d, shopping: [...d.shopping, { id: tmpId(), name, qty: 1 }] }), () => api.addShopping(name)),
      setBought: (id: string, bought: boolean) => run((d) => ({ ...d, shopping: d.shopping.map((i) => (i.id === id ? { ...i, bought_at: bought ? nowIso() : null } : i)) }), () => api.setBought(id, bought)),
      setQty: (id: string, qty: number) => run((d) => ({ ...d, shopping: d.shopping.map((i) => (i.id === id ? { ...i, qty } : i)) }), () => api.setQty(id, qty)),
      clearBought: () => run((d) => ({ ...d, shopping: d.shopping.filter((i) => !i.bought_at) }), () => api.clearBought()),

      /** Phone: the signed-in person's own list, through the snapshot (so it live-updates). */
      saveMyTask: (t: PrivateTaskDraft) => run((d) => ({
        ...d,
        myTasks: t.id
          ? d.myTasks.map((x) => (x.id === t.id ? { ...x, title: t.title, due_on: t.due_on ?? null, done_at: t.done ? nowIso() : null } : x))
          : [...d.myTasks, { id: tmpId(), title: t.title, due_on: t.due_on ?? null, done_at: null }],
      }), () => api.saveMyTask(t)),
      checkPin: (pin: string) => api.checkPin(pin),
      privateTasks: (person: PersonKey, pin: string) => api.privateTasks(person, pin),
      savePrivateTask: (person: PersonKey, pin: string, t: PrivateTaskDraft) => api.savePrivateTask(person, pin, t),
    };
  }, [api, run, setToast]);

  const names = useMemo(() => ({
    a: data?.members.find((m) => m.person === 'a')?.name ?? 'Frank',
    b: data?.members.find((m) => m.person === 'b')?.name ?? 'Sarah',
  }), [data?.members]);

  return { mode: api.mode, data, error, refresh, toast, setToast, names, ...actions };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function NookProvider({ api, children }: { api: Api; children: ReactNode }) {
  const value = useStoreValue(api);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside NookProvider');
  return s;
}
