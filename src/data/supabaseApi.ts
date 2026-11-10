import type { SupabaseClient } from '@supabase/supabase-js';
import type { Chore } from '../nook';
import type { Api, Category, Member, ShoppingItem, Snapshot, Task } from './api';

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
const ok = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };
const doneAt = (done: boolean) => (done ? new Date().toISOString() : null);

export function supabaseApi(sb: SupabaseClient, userId: string): Api {
  return {
    mode: 'supabase',

    async load(): Promise<Snapshot> {
      const [plan, chores, categories, tasks, shopping, usuals, members] = await Promise.all([
        sb.from('plans').select('data').maybeSingle(),
        sb.from('chores').select('*').order('created_at'),
        sb.from('task_categories').select('*').order('sort'),
        // RLS returns the shared tasks plus this user's own private ones (none for the tablet)
        sb.from('tasks').select('*').order('created_at'),
        sb.from('shopping_items').select('*').is('cleared_at', null).order('created_at'),
        sb.from('shopping_usuals').select('name'),
        sb.from('members').select('user_id, person, name'),
      ]);
      const p = must(plan) as { data: Snapshot['plan'] } | null;
      const allTasks = must(tasks) as Task[];
      const people = must(members) as Member[];
      return {
        plan: p?.data ?? { width: 120, height: 80, rooms: [], items: [] },
        chores: must(chores) as Chore[],
        categories: must(categories) as Category[],
        tasks: allTasks.filter((t) => !t.owner),
        myTasks: allTasks.filter((t) => t.owner === userId),
        shopping: must(shopping) as ShoppingItem[],
        usuals: (must(usuals) as { name: string }[]).map((u) => u.name),
        members: people,
        me: people.find((m) => m.user_id === userId) ?? null,
      };
    },

    subscribe(onChange) {
      let t: number | undefined;
      const bump = () => { window.clearTimeout(t); t = window.setTimeout(onChange, 150); };
      // a unique topic: StrictMode (and remounts) subscribe again before the old channel has finished leaving
      const ch = sb.channel(`nook-${Math.random().toString(36).slice(2)}`);
      for (const table of ['plans', 'chores', 'task_categories', 'tasks', 'shopping_items']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, bump);
      }
      let joined = false;
      // after a reconnect (tablet asleep, Wi-Fi drop) re-read, since changes made meanwhile were missed
      ch.subscribe((status) => { if (status === 'SUBSCRIBED') { if (joined) bump(); joined = true; } });
      return () => { window.clearTimeout(t); sb.removeChannel(ch); };
    },

    async completeChore(id) { ok(await sb.rpc('complete_chore', { p_id: id })); },
    async snoozeChore(id, until) { ok(await sb.rpc('snooze_chore', { p_id: id, p_until: until })); },
    async logUse(id) { ok(await sb.rpc('log_use', { p_id: id })); },
    async restoreChore(c) {
      ok(await sb.from('chores').update({ last_done_at: c.last_done_at ?? null, uses: c.uses ?? 0, snoozed_until: c.snoozed_until ?? null }).eq('id', c.id));
    },
    async saveChore(c) {
      const row = { title: c.title, target_id: c.target_id, icon: c.icon ?? null, interval_days: c.interval_days ?? null, use_limit: c.use_limit ?? null };
      if (c.id) ok(await sb.from('chores').update(row).eq('id', c.id));
      else ok(await sb.from('chores').insert({ ...row, last_done_at: c.last_done_at ?? null, uses: c.uses ?? 0, snoozed_until: c.snoozed_until ?? null }));
    },
    async deleteChore(id) { ok(await sb.from('chores').delete().eq('id', id)); },

    async savePlan(plan, removedTargets) {
      // household_id defaults to my_household(), so this inserts the first plan or replaces the existing one
      ok(await sb.from('plans').upsert({ data: plan, updated_at: new Date().toISOString() }, { onConflict: 'household_id' }));
      if (removedTargets.length) ok(await sb.from('chores').delete().in('target_id', removedTargets));
    },

    async addCategory(name, icon) {
      const last = must(await sb.from('task_categories').select('sort').order('sort', { ascending: false }).limit(1)) as { sort: number }[];
      ok(await sb.from('task_categories').insert({ name, icon, sort: (last[0]?.sort ?? -1) + 1 }));
    },
    async updateCategory(id, patch) { ok(await sb.from('task_categories').update(patch).eq('id', id)); },
    async deleteCategory(id) { ok(await sb.from('task_categories').delete().eq('id', id)); },
    async addTask(categoryId, title) { ok(await sb.from('tasks').insert({ category_id: categoryId, title })); },
    async setTaskDone(id, done) { ok(await sb.from('tasks').update({ done_at: doneAt(done) }).eq('id', id)); },

    async addShopping(name, qty = 1) { ok(await sb.from('shopping_items').insert({ name, qty })); },
    async setBought(id, bought) { ok(await sb.from('shopping_items').update({ bought_at: doneAt(bought) }).eq('id', id)); },
    async setQty(id, qty) { ok(await sb.from('shopping_items').update({ qty }).eq('id', id)); },
    async clearBought() { ok(await sb.from('shopping_items').update({ cleared_at: new Date().toISOString() }).not('bought_at', 'is', null).is('cleared_at', null)); },

    async checkPin(pin) { return must(await sb.rpc('check_tasks_pin', { p_pin: pin })) as boolean; },
    async privateTasks(person, pin) { return must(await sb.rpc('private_tasks', { p_person: person, p_pin: pin })) as Task[]; },
    async savePrivateTask(person, pin, t) {
      const row = must(await sb.rpc('save_private_task', { p_person: person, p_pin: pin, p_id: t.id ?? null, p_title: t.title, p_done: t.done, p_due: t.due_on ?? null }));
      if (!row || !(row as Task).id) throw new Error('wrong pin');
    },
    async saveMyTask(t) {
      const row = { title: t.title, due_on: t.due_on ?? null, done_at: doneAt(t.done) };
      if (t.id) ok(await sb.from('tasks').update(row).eq('id', t.id).eq('owner', userId));
      else ok(await sb.from('tasks').insert({ ...row, owner: userId }));
    },
  };
}
