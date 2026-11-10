import { Button, Chip, Icon, QuickAdd, TaskItem } from '../nook';
import { useStore } from '../data/store';

/** One shared list: type or tap a usual, tick as it goes in the basket, clear at the end. */
export function Shopping() {
  const store = useStore();
  const { shopping, usuals } = store.data!;
  const left = shopping.filter((i) => !i.bought_at), got = shopping.filter((i) => i.bought_at);

  const add = (name: string) => {
    const existing = shopping.find((i) => i.name.toLowerCase() === name.toLowerCase() && !i.bought_at);
    if (existing) store.setQty(existing.id, existing.qty + 1); else store.addShopping(name);
  };
  const row = (i: (typeof shopping)[number]) => <TaskItem key={i.id} title={i.name} qty={i.qty} done={!!i.bought_at} onToggle={(d) => store.setBought(i.id, d)} />;
  const suggestions = usuals.filter((u) => !shopping.some((i) => i.name.toLowerCase() === u.toLowerCase()));

  return (
    <>
      <main className="pane">
        <header><div className="nk-eyebrow">{left.length} to get</div><h1 className="nk-h1">Shopping</h1></header>
        <QuickAdd placeholder="Add to the list" onAdd={add} />
        <div className="nk-group" style={{ flex: 1, overflow: 'auto' }}>
          {shopping.length === 0 && <p style={{ margin: 16, color: 'var(--ink-muted)' }}>The list is empty. Add something above, or tap a usual.</p>}
          <div className="nk-group__body">{left.map(row)}</div>
          {got.length > 0 && (
            <details className="nk-done-section" open>
              <summary>
                <Icon name="chevron-right" size={20} />In the basket ({got.length})
                <span style={{ marginLeft: 'auto' }}><Button variant="ghost" icon="trash" onClick={(e) => { e.preventDefault(); store.clearBought(); }}>Clear</Button></span>
              </summary>
              {got.map(row)}
            </details>
          )}
        </div>
      </main>
      <aside className="side side--under-head" style={{ '--side-w': '380px', gap: 12 } as React.CSSProperties}>
        <div style={{ fontSize: 22, fontWeight: 650 }}>Usuals</div>
        <div style={{ fontSize: 15, color: 'var(--ink-muted)', marginTop: -8 }}>Tap to add. These come from what you buy often.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {suggestions.map((u) => <Chip key={u} icon="plus" onClick={() => add(u)}>{u}</Chip>)}
        </div>
      </aside>
    </>
  );
}
