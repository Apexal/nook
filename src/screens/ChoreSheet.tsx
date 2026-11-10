import { useEffect, useState } from 'react';
import { Button, HeatBadge, Select, Sheet, Stepper, TextField, UseMeter, choreHeat, heatLabel, type Chore, type IconName } from '../nook';
import { useStore } from '../data/store';
import { agoText, scheduleText, targetName, targetOptions } from '../lib/where';

type Mode = 'time' | 'uses' | 'both';
type Unit = 'days' | 'weeks' | 'months';
const UNIT_DAYS: Record<Unit, number> = { days: 1, weeks: 7, months: 30 };
const ICONS: { value: IconName; label: string }[] = [
  { value: 'sparkle', label: 'Clean' }, { value: 'drop', label: 'Water' }, { value: 'wrench', label: 'Maintain' },
  { value: 'folder', label: 'Tidy / organise' }, { value: 'trash', label: 'Take out' }, { value: 'leaf', label: 'Plants' }, { value: 'cart', label: 'Restock' },
];

function splitInterval(days?: number | null): [number, Unit] {
  if (!days) return [1, 'weeks'];
  if (days % 30 === 0) return [days / 30, 'months'];
  if (days % 7 === 0) return [days / 7, 'weeks'];
  return [days, 'days'];
}

/** Chore details (done / snooze / +1 use) and its editor. `choreId === null` creates a new one. */
export function ChoreSheet({ choreId, presetTarget, onClose }: { choreId: string | null; presetTarget?: string | null; onClose: () => void }) {
  const store = useStore();
  const { plan, chores } = store.data!;
  // read the live row, so +1 use, done and changes from the other phone show while the sheet is open
  const chore: Chore | null = choreId ? chores.find((c) => c.id === choreId) ?? null : null;
  const gone = choreId !== null && !chore;
  useEffect(() => { if (gone) onClose(); }, [gone, onClose]);   // deleted elsewhere
  const [editing, setEditing] = useState(choreId === null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(chore?.title ?? '');
  const [target, setTarget] = useState(chore?.target_id ?? presetTarget ?? plan.rooms[0]?.id ?? '');
  const [icon, setIcon] = useState<IconName>((chore?.icon as IconName) ?? 'sparkle');
  const [mode, setMode] = useState<Mode>(chore?.use_limit ? (chore.interval_days ? 'both' : 'uses') : 'time');
  const [n0, u0] = splitInterval(chore?.interval_days);
  const [every, setEvery] = useState(n0);
  const [unit, setUnit] = useState<Unit>(u0);
  const [uses, setUses] = useState(chore?.use_limit ?? 1);

  if (gone) return null;

  if (!editing && chore) {
    const level = choreHeat(chore);
    return (
      <Sheet title={chore.title} eyebrow={targetName(plan, chore.target_id)} onClose={onClose}
        subtitle={<HeatBadge level={level} label={heatLabel(chore)} />}
        footer={<>
          <Button variant="secondary" icon="clock" onClick={() => { store.snoozeChore(chore); onClose(); }}>Snooze</Button>
          <Button icon="check" onClick={() => { store.completeChore(chore); onClose(); }}>Mark done</Button>
        </>}>
        <p style={{ margin: 0, fontSize: 20, lineHeight: '28px' }}>{scheduleText(chore)}. Last done {agoText(chore.last_done_at)}.</p>
        {chore.use_limit ? <UseMeter uses={chore.uses ?? 0} limit={chore.use_limit} onAdd={() => store.logUse(chore)} /> : null}
        <div><Button variant="ghost" icon="pencil" onClick={() => setEditing(true)}>Edit chore</Button></div>
      </Sheet>
    );
  }

  const valid = !!title.trim() && !!target;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const ok = await store.saveChore({
      id: chore?.id, title: title.trim(), target_id: target, icon,
      interval_days: mode === 'uses' ? null : every * UNIT_DAYS[unit],
      use_limit: mode === 'time' ? null : uses,
    });
    setBusy(false);
    if (ok) onClose();   // on failure keep the form; the toast says why
  };

  return (
    <Sheet title={chore ? 'Edit chore' : 'New chore'} eyebrow={chore ? chore.title : undefined} onClose={onClose}
      footer={<>
        {chore ? <Button variant="secondary" icon="trash" onClick={() => { store.deleteChore(chore); onClose(); }}>Delete</Button>
          : <Button variant="secondary" onClick={onClose}>Cancel</Button>}
        <Button icon="check" disabled={!valid || busy} onClick={save}>Save</Button>
      </>}>
      <TextField label="What" placeholder="e.g. Vacuum carpet" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!chore} />
      <Select block label="Where" value={target} onChange={setTarget} options={targetOptions(plan)} />
      <Select block label="Schedule" value={mode} onChange={(v) => setMode(v as Mode)} options={[
        { value: 'time', label: 'Every so often', icon: 'calendar' },
        { value: 'uses', label: 'After some uses', icon: 'tally', description: 'Tap “+1 use” each time' },
        { value: 'both', label: 'Whichever comes first', icon: 'clock' },
      ]} />
      {mode !== 'uses' && (
        <div className="nk-row">
          <Stepper label="Every" value={every} min={1} max={365} onChange={setEvery} />
          <Select label="Unit" value={unit} onChange={(v) => setUnit(v as Unit)} up options={[{ value: 'days', label: every === 1 ? 'day' : 'days' }, { value: 'weeks', label: every === 1 ? 'week' : 'weeks' }, { value: 'months', label: every === 1 ? 'month' : 'months' }]} />
        </div>
      )}
      {mode !== 'time' && <Stepper label={mode === 'both' ? 'Or after' : 'After'} value={uses} min={1} max={500} unit={['use', 'uses']} onChange={setUses} />}
      <Select block up label="Icon" value={icon} onChange={(v) => setIcon(v as IconName)} options={ICONS.map((i) => ({ ...i, icon: i.value }))} />
    </Sheet>
  );
}
