import { useCallback, useEffect, useState } from 'react';
import { Button, IconButton, PinPad, Select, Sheet, TaskGroup, TaskItem, TextField, type IconName } from '../nook';
import type { Category, PersonKey, PrivateTaskDraft, Task } from '../data/api';
import { useStore } from '../data/store';
import { dueText } from '../lib/where';

const CATEGORY_ICONS: IconName[] = ['folder', 'tag', 'leaf', 'cart', 'heart', 'wrench', 'home', 'calendar'];
const RECENT = 7 * 86400000;
const PEOPLE: PersonKey[] = ['a', 'b'];

function TaskRow({ t, onToggle }: { t: Task; onToggle: (done: boolean) => void }) {
  const due = t.done_at ? { late: false, text: undefined } : dueText(t.due_on);
  return <TaskItem title={t.title} meta={due.text} late={due.late} done={!!t.done_at} onToggle={onToggle} />;
}

/** Open tasks, and the ones ticked in the last week (tucked under "Done"). */
function split(list: Task[]) {
  const now = Date.now();
  return { open: list.filter((t) => !t.done_at), done: list.filter((t) => t.done_at && now - new Date(t.done_at).getTime() < RECENT) };
}

/** Toggling keeps the title and due date: the save replaces the whole row. */
const toggled = (t: Task, done: boolean): PrivateTaskDraft => ({ id: t.id, title: t.title, due_on: t.due_on ?? null, done });

function CategorySheet({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'folder');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = category ? await store.updateCategory(category.id, { name: name.trim(), icon }) : await store.addCategory(name.trim(), icon);
    setBusy(false);
    if (ok) onClose();   // on failure keep the sheet open with what was typed; the toast says why
  };
  return (
    <Sheet title={category ? 'Edit category' : 'New category'} onClose={onClose}
      footer={<>
        {category ? <Button variant="danger" icon="trash" onClick={() => { store.deleteCategory(category.id); onClose(); }}>Delete</Button> : <Button variant="secondary" onClick={onClose}>Cancel</Button>}
        <Button icon="check" disabled={!name.trim() || busy} onClick={save}>Save</Button>
      </>}>
      <TextField label="Name" placeholder="e.g. Lisbon trip" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <Select block label="Icon" value={icon} onChange={setIcon} options={CATEGORY_ICONS.map((i) => ({ value: i, label: i.charAt(0).toUpperCase() + i.slice(1), icon: i }))} />
      {category && <p className="nk-field__hint" style={{ margin: 0 }}>Deleting a category deletes its tasks too.</p>}
    </Sheet>
  );
}

function PrivateGroup({ person, tasks, onSave }: { person: PersonKey; tasks: Task[] | null; onSave: (t: PrivateTaskDraft) => void }) {
  const store = useStore();
  const { open, done } = split(tasks ?? []);
  return (
    <TaskGroup title={`${store.names[person]}'s list`} icon="unlock" person={person} count={open.length}
      onAdd={(title) => onSave({ title, done: false })}
      done={done.length ? done.map((t) => <TaskRow key={t.id} t={t} onToggle={(d) => onSave(toggled(t, d))} />) : undefined} doneCount={done.length}>
      {tasks === null ? <div className="nk-task__meta" style={{ padding: 12 }}>Opening…</div>
        : open.map((t) => <TaskRow key={t.id} t={t} onToggle={(d) => onSave(toggled(t, d))} />)}
    </TaskGroup>
  );
}

let tmpN = 0;

/** Tablet: one person's private list, read and written with the household PIN. */
function PinnedList({ person, pin, onLock }: { person: PersonKey; pin: string; onLock: () => void }) {
  const store = useStore();
  const { privateTasks, savePrivateTask, setToast } = store;
  const [mine, setMine] = useState<Task[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try { setMine(await privateTasks(person, pin)); setFailed(false); }
    catch (e) {
      if (/wrong pin|too many/i.test(String(e))) onLock();   // the PIN was changed elsewhere, or locked out
      else setFailed(true);                                   // a network blip: say so, don't lock
    }
  }, [privateTasks, person, pin, onLock]);
  useEffect(() => { load(); }, [load]);

  const save = async (t: PrivateTaskDraft) => {
    const doneAt = t.done ? new Date().toISOString() : null;
    setMine((m) => m && (t.id ? m.map((x) => (x.id === t.id ? { ...x, done_at: doneAt } : x)) : [...m, { id: `tmp-${++tmpN}`, title: t.title, done_at: null }]));
    try { await savePrivateTask(person, pin, t); }
    catch (e) {
      if (/wrong pin/i.test(String(e))) { onLock(); return; }
      setToast({ icon: 'alert', message: `Couldn't save: ${e instanceof Error ? e.message : e}` });
    }
    load();
  };

  if (failed) {
    return <div className="nk-group" style={{ padding: 16 }}>Couldn't open {store.names[person]}'s list. <Button variant="ghost" onClick={load}>Try again</Button></div>;
  }
  return <PrivateGroup person={person} tasks={mine} onSave={save} />;
}

/** Shared categories (open to both of you) and the private lists: your own on your phone, both behind the household PIN on the tablet. */
export function Tasks({ pin, onUnlock, onLock }: { pin: string | null; onUnlock: (pin: string) => void; onLock: () => void }) {
  const store = useStore();
  const { categories, tasks, me, myTasks } = store.data!;
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  const group = (c: Category) => {
    const { open, done } = split(tasks.filter((t) => t.category_id === c.id));
    return (
      <div key={c.id} style={{ breakInside: 'avoid', marginBottom: 16 }}>
        <TaskGroup title={c.name} icon={c.icon as IconName} count={open.length} onAdd={(t) => store.addTask(c.id, t)}
          actions={<IconButton icon="pencil" label={`Edit ${c.name}`} onClick={() => setEditing(c)} />}
          done={done.length ? done.map((t) => <TaskRow key={t.id} t={t} onToggle={(d) => store.setTaskDone(t.id, d)} />) : undefined} doneCount={done.length}>
          {open.map((t) => <TaskRow key={t.id} t={t} onToggle={(d) => store.setTaskDone(t.id, d)} />)}
        </TaskGroup>
      </div>
    );
  };

  let privateLists;
  if (me?.person) {
    // a phone signed in as Frank or Sarah reads their own list directly
    privateLists = <PrivateGroup person={me.person} tasks={myTasks} onSave={(t) => { store.saveMyTask(t); }} />;
  } else if (!pin) {
    privateLists = (
      <PinPad name="Private lists" person="home" greeting="Private lists are locked"
        onComplete={async (p) => {
          try { if (!(await store.checkPin(p))) return false; }
          catch (e) {
            store.setToast({ icon: 'alert', message: /too many/i.test(String(e)) ? 'Too many wrong PINs. Try again in a few minutes.' : `Couldn't check the PIN: ${e instanceof Error ? e.message : e}` });
            return false;
          }
          onUnlock(p); return true;
        }} />
    );
  } else {
    privateLists = <>
      {PEOPLE.map((p) => <PinnedList key={p} person={p} pin={pin} onLock={onLock} />)}
      <Button variant="secondary" icon="lock" onClick={onLock}>Lock private lists</Button>
    </>;
  }

  return (
    <>
      <main className="pane" style={{ overflow: 'auto' }}>
        <header className="screen-head" style={{ justifyContent: 'space-between' }}>
          <div><div className="nk-eyebrow">Shared with both of you</div><h1 className="nk-h1">Tasks</h1></div>
          <Button variant="secondary" icon="plus" onClick={() => setEditing('new')}>New category</Button>
        </header>
        {categories.length
          ? <div className="task-columns">{categories.map(group)}</div>
          : <p style={{ color: 'var(--ink-muted)' }}>No categories yet. Make one for anything you're sorting out together.</p>}
      </main>
      <aside className="side" style={{ '--side-w': '420px', gap: 16, overflow: 'auto', alignItems: !me?.person && !pin ? 'center' : undefined } as React.CSSProperties}>
        <div className="nk-eyebrow private-title" style={{ alignSelf: 'stretch' }}>{me?.person ? 'Your private list' : 'Private lists'}</div>
        {privateLists}
      </aside>
      {editing && <CategorySheet category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
