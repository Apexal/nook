import { useMemo, useState } from 'react';
import { Button, Floorplan, HeatLegend, applyHeat, choreHeat, useNow } from '../nook';
import { useStore } from '../data/store';
import { usePhone } from '../lib/device';
import { roomOf, targetName } from '../lib/where';
import { ChoreRow } from './ChoreRow';
import { ChoreSheet } from './ChoreSheet';

function greeting(d: Date) { const h = d.getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

export function Home() {
  const store = useStore();
  const { plan, chores } = store.data!;
  const now = useNow();
  const phone = usePhone();
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<string | 'new' | null>(null);

  const heated = useMemo(() => applyHeat(plan, chores, now), [plan, chores, now]);
  // the room lookup is geometry: only redo it when the plan or the chores change, not every minute
  const rooms = useMemo(() => new Map(chores.map((c) => [c.id, roomOf(plan, c.target_id)?.id])), [plan, chores]);
  const list = useMemo(() => chores
    .map((c) => ({ c, l: choreHeat(c, now) }))
    .filter((x) => x.l >= (sel ? 1 : 2) && (!sel || x.c.target_id === sel || rooms.get(x.c.id) === sel))
    .sort((a, b) => b.l - a.l), [chores, now, sel, rooms]);
  const selName = sel ? targetName(plan, sel) : null;

  return (
    <>
      <main className="pane" style={{ gap: 16 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="nk-eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <h1 className="nk-h1">{greeting(now)}, you two</h1>
          </div>
        </header>
        {!phone && <>
          <Floorplan plan={heated} selectedId={sel} onSelect={setSel} style={{ flex: 1 }} />
          <HeatLegend />
        </>}
      </main>
      <aside className="side" style={{ '--side-w': '440px' } as React.CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minHeight: 50 }}>
          <span className="nk-numeral">{list.length}</span>
          <span style={{ fontSize: 22, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sel ? `in ${selName}` : list.length === 1 ? 'thing needs love' : 'things need love'}
          </span>
          {sel && <Button variant="ghost" style={{ marginLeft: 'auto', minHeight: 40, padding: '0 12px' }} onClick={() => setSel(null)}>Show all</Button>}
        </div>
        <div className="scroll-list">
          {list.length ? list.map(({ c }) => (
            <ChoreRow key={c.id} chore={c} where={targetName(plan, c.target_id)} now={now} onOpen={setOpen} />
          )) : (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--ink-muted)' }}>
              <svg width="120" height="72" viewBox="0 0 120 72" aria-hidden="true"><rect x="0" y="24" width="56" height="48" rx="24" style={{ fill: 'var(--lilac)' }} /><circle cx="88" cy="36" r="32" style={{ fill: 'var(--brand-soft)' }} /></svg>
              <div style={{ fontSize: 22, fontWeight: 650, color: 'var(--ink)', marginTop: 12 }}>All fresh here</div>
              Nothing due. Enjoy it.
            </div>
          )}
        </div>
        <Button variant="secondary" icon="plus" block onClick={() => setOpen('new')}>{sel ? `Add a chore in ${plan.rooms.find((r) => r.id === sel)?.name ?? 'here'}` : 'Add a chore'}</Button>
      </aside>
      {open && <ChoreSheet choreId={open === 'new' ? null : open} presetTarget={sel} onClose={() => setOpen(null)} />}
    </>
  );
}
