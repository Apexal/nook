import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, ChoreCard, Floorplan, IconButton, ItemPalette, Select, Sheet, TextField, choreHeat, itemKinds, planBounds, roomPoints, takesChores,
  type Floor, type IconName, type ItemKind, type Plan, type PlanChange, type PlanItem, type PlanRoom,
} from '../nook';
import { useStore } from '../data/store';
import { scheduleText } from '../lib/where';
import { ChoreSheet } from './ChoreSheet';

const FLOOR_OPTIONS = (['wood', 'vinyl', 'tile', 'carpet', 'concrete'] as Floor[]).map((f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1), material: f }));

function applyChange(p: Plan, c: PlanChange): Plan {
  if (c.type === 'room') return { ...p, rooms: p.rooms.map((r) => (r.id === c.id ? { ...r, points: c.points, x: undefined, y: undefined, w: undefined, h: undefined } : r)) };
  return { ...p, items: p.items.map((i) => (i.id === c.id ? { ...i, x: c.x, y: c.y, w: c.w, h: c.h, r: c.r, points: c.points ?? i.points } : i)) };
}
const ids = (p: Plan) => new Set([...p.rooms.map((r) => r.id), ...p.items.map((i) => i.id)]);

/** Palette · plan on a grid · inspector. Edits stay local until Save. */
export function PlanEditor() {
  const store = useStore();
  const saved = store.data!.plan;
  const chores = store.data!.chores;
  const [history, setHistory] = useState<Plan[]>([saved]);
  const plan = history[history.length - 1];
  const [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [choreOpen, setChoreOpen] = useState<string | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = plan !== saved;

  // When the saved plan changes underneath us (other device) and nothing is pending here, follow it.
  useEffect(() => { setHistory((h) => (h.length === 1 ? [saved] : h)); }, [saved]);

  /** Push an edit for Undo. Edits with the same `group` in a row (typing a name) replace each other, so Undo takes back the whole word. */
  const lastGroup = useRef<string | null>(null);
  const commit = (next: Plan, group: string | null = null) => {
    const merge = group !== null && group === lastGroup.current;
    lastGroup.current = group;
    setHistory((h) => (merge && h.length > 1 ? [...h.slice(0, -1), next] : [...h, next]));
  };
  const undo = () => { lastGroup.current = null; setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h)); };
  const setItem = (id: string, f: Partial<PlanItem>, group?: string) => commit({ ...plan, items: plan.items.map((i) => (i.id === id ? { ...i, ...f } : i)) }, group);
  const setRoom = (id: string, f: Partial<PlanRoom>, group?: string) => commit({ ...plan, rooms: plan.rooms.map((r) => (r.id === id ? { ...r, ...f } : r)) }, group);

  const savedIds = useMemo(() => ids(saved), [saved]);
  const removed = useMemo(() => { const now = ids(plan); return [...savedIds].filter((id) => !now.has(id)); }, [plan, savedIds]);
  const doomed = chores.filter((c) => removed.includes(c.target_id));

  const save = async () => {
    setSaving(true);
    const ok = await store.savePlan(plan, removed);
    setSaving(false);
    lastGroup.current = null;
    if (ok) setHistory([plan]);   // on failure the edits stay here, still unsaved
  };

  const place = (e: { kind: string; x: number; y: number; roomId: string | null }) => {
    if (e.kind.startsWith('floor:')) { if (e.roomId) setRoom(e.roomId, { floor: e.kind.slice(6) as Floor }); setTool(null); return; }
    const kind = e.kind as ItemKind, k = itemKinds[kind], id = `${kind}-${Date.now().toString(36)}`;
    commit({ ...plan, items: [...plan.items, { id, kind, x: k.wall ? e.x : e.x - k.w / 2, y: k.wall ? e.y : e.y - k.h / 2 }] });
    setSel(id); setTool(null);
  };
  const addRoom = () => {
    // Beside what's already drawn, so plans grow sideways as well as down.
    const id = `room-${Date.now().toString(36)}`, empty = !plan.rooms.length && !plan.items.length && !plan.outline, b = planBounds(plan);
    const x = empty ? 0 : Math.round(b.x + b.w + 5), y = empty ? 0 : Math.round(b.y);
    commit({ ...plan, rooms: [...plan.rooms, { id, name: 'New room', floor: 'wood', x, y, w: 30, h: 20 }], width: Math.max(plan.width, x + 30), height: Math.max(plan.height, y + 20) });
    setSel(id);
  };
  const remove = (id: string) => { commit({ ...plan, rooms: plan.rooms.filter((r) => r.id !== id), items: plan.items.filter((i) => i.id !== id) }); setSel(null); };

  const item = plan.items.find((i) => i.id === sel), room = plan.rooms.find((r) => r.id === sel);
  const here = chores.filter((c) => c.target_id === sel).map((c) => ({ c, l: choreHeat(c) })).sort((a, b) => b.l - a.l);
  const choreList = (
    <div>
      <div className="nk-sheet__section-title">{here.length ? 'Chores here' : 'No chores here yet'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {here.map(({ c, l }) => <ChoreCard key={c.id} title={c.title} schedule={scheduleText(c)} level={l} icon={(c.icon as IconName) ?? undefined} onOpen={() => setChoreOpen(c.id)} />)}
        <Button variant="soft" icon="plus" disabled={!sel || !savedIds.has(sel) || removed.includes(sel)} onClick={() => setChoreOpen('new')}>Add a chore here</Button>
        {sel && !savedIds.has(sel) && <div className="nk-field__hint">Save the plan first, then add chores here.</div>}
        {here.length > 0 && <div className="nk-field__hint">Removing this also deletes {here.length === 1 ? 'its chore' : `its ${here.length} chores`} when you save.</div>}
      </div>
    </div>
  );

  let inspector;
  if (item) {
    const k = itemKinds[item.kind];
    inspector = (
      <Sheet inline eyebrow={k.label} title={item.name || k.label} onClose={() => setSel(null)}
        footer={<><Button variant="secondary" icon="trash" onClick={() => remove(item.id)}>Remove</Button><Button icon="check" onClick={() => setSel(null)}>Done</Button></>}>
        <TextField label="Name" value={item.name ?? ''} placeholder={k.label} onChange={(e) => setItem(item.id, { name: e.target.value }, `name:${item.id}`)} />
        {item.kind === 'closet' && <Select block label="Doors" value={item.door ?? 'sliding'} onChange={(v) => setItem(item.id, { door: v as PlanItem['door'] })}
          options={[{ value: 'sliding', label: 'Sliding' }, { value: 'hinged', label: 'Hinged (pair)' }, { value: 'none', label: 'No doors' }]} />}
        <div className="nk-row">
          <Button variant="secondary" icon="rotate" onClick={() => setItem(item.id, { r: ((item.r ?? 0) + 90) % 360 })}>Rotate</Button>
          {item.kind === 'door' && <Button variant="secondary" icon="flip" onClick={() => setItem(item.id, { flip: !item.flip })}>Flip swing</Button>}
          {k.shapeable && item.points && <Button variant="secondary" onClick={() => setItem(item.id, { points: undefined })}>Make rectangular</Button>}
        </div>
        {k.shapeable && <p className="nk-field__hint" style={{ margin: 0 }}>Drag a corner to resize. Tap + on an edge to add a step, then drag it out to make an L or U sectional. The back runs along the top edge.</p>}
        {takesChores(item.kind) && choreList}
      </Sheet>
    );
  } else if (room) {
    const pts = roomPoints(room);
    inspector = (
      <Sheet inline eyebrow="Room" title={room.name} onClose={() => setSel(null)}
        footer={<><Button variant="secondary" icon="trash" onClick={() => remove(room.id)}>Remove</Button><Button icon="check" onClick={() => setSel(null)}>Done</Button></>}>
        <TextField label="Name" value={room.name} onChange={(e) => setRoom(room.id, { name: e.target.value }, `name:${room.id}`)} />
        <Select block label="Floor" value={room.floor} onChange={(v) => setRoom(room.id, { floor: v as Floor })} options={FLOOR_OPTIONS} />
        <p className="nk-field__hint" style={{ margin: 0 }}>Drag a corner to reshape: walls stay square. Tap + on a wall to add a step, then drag it to make an L. {pts.length > 4 ? `This room has ${pts.length} corners.` : ''}</p>
        {choreList}
      </Sheet>
    );
  } else {
    inspector = <div style={{ padding: 24, color: 'var(--ink-muted)' }}>Select a room, item, door or closet to edit it. Pick something on the left, then tap the plan to place it.</div>;
  }

  return (
    <>
      <div style={{ width: 244, flex: 'none', overflow: 'auto', padding: '24px 12px 24px 20px', boxSizing: 'border-box' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Add to plan</div>
        <ItemPalette value={tool} onPick={setTool} />
      </div>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 16px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <IconButton icon="undo" label="Undo" disabled={history.length < 2} onClick={undo} />
          <Button variant="ghost" icon="plus" onClick={addRoom}>Room</Button>
          <span style={{ flex: 1 }} />
          {dirty && <Button variant="ghost" disabled={saving} onClick={() => { lastGroup.current = null; setHistory([saved]); setSel(null); }}>Discard</Button>}
          <Button icon="check" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}</Button>
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink-muted)', marginTop: -6 }}>
          {tool ? 'Tap the plan to place it' : doomed.length ? `Saving also deletes ${doomed.length} chore${doomed.length > 1 ? 's' : ''} on removed things` : 'Moves and sizes snap to 10 cm'}
        </div>
        <Floorplan plan={plan} mode="edit" selectedId={sel} onSelect={setSel} onChange={(c) => commit(applyChange(plan, c))} armedKind={tool} onPlace={place} style={{ flex: 1, minHeight: 0 }} />
      </main>
      <div style={{ width: 360, flex: 'none', padding: '16px 16px 16px 0', boxSizing: 'border-box' }}>{inspector}</div>
      {choreOpen && <ChoreSheet choreId={choreOpen === 'new' ? null : choreOpen} presetTarget={sel} onClose={() => setChoreOpen(null)} />}
    </>
  );
}
