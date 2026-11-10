import { useMemo, useState } from 'react';
import { Button, SegmentedControl, choreHeat, useNow, type Chore } from '../nook';
import { useStore } from '../data/store';
import { roomOf, targetName } from '../lib/where';
import { ChoreRow } from './ChoreRow';
import { ChoreSheet } from './ChoreSheet';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(460px, 100%), 1fr))', gap: 10 } as const;

/** Every chore, by room or hottest first. */
export function Chores() {
  const store = useStore();
  const { plan, chores } = store.data!;
  const now = useNow();
  const [by, setBy] = useState('room');
  const [open, setOpen] = useState<string | 'new' | null>(null);

  // hottest first, heat worked out once per chore rather than inside the sort
  const hottest = useMemo(() => chores.map((c) => ({ c, l: choreHeat(c, now) })).sort((a, b) => b.l - a.l).map((x) => x.c), [chores, now]);
  const groups = useMemo(() => {
    const byRoom = new Map<string, Chore[]>();
    for (const c of hottest) { const r = roomOf(plan, c.target_id)?.id; if (r) byRoom.set(r, [...(byRoom.get(r) ?? []), c]); }
    return plan.rooms.map((room) => ({ room, list: byRoom.get(room.id) ?? [] })).filter((g) => g.list.length);
  }, [plan, hottest]);

  const row = (c: Chore, where: string) => <ChoreRow key={c.id} chore={c} where={where} now={now} onOpen={setOpen} />;

  return (
    <main className="pane pane--alone">
      <header className="screen-head">
        <div style={{ flex: 1 }}><div className="nk-eyebrow">{chores.length} chores around the home</div><h1 className="nk-h1">Chores</h1></div>
        <SegmentedControl value={by} onChange={setBy} options={[{ value: 'room', label: 'By room' }, { value: 'heat', label: 'Hottest first' }]} />
        <Button icon="plus" onClick={() => setOpen('new')}>New chore</Button>
      </header>
      <div className="scroll-list" style={{ display: 'block', paddingBottom: 24 }}>
        {by === 'heat'
          ? <div style={GRID}>{hottest.map((c) => row(c, targetName(plan, c.target_id)))}</div>
          : groups.map((g) => (
            <section key={g.room.id} style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: '34px' }}>{g.room.name}</h2>
              <div style={GRID}>
                {g.list.map((c) => row(c, c.target_id === g.room.id ? 'Floor' : targetName(plan, c.target_id).split(' · ').slice(1).join(' · ')))}
              </div>
            </section>
          ))}
      </div>
      {open && <ChoreSheet choreId={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </main>
  );
}
