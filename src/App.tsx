import { useCallback, useMemo, useState } from 'react';
import { Button, IconButton, NavRail, Toast, choreHeat, useAutoTheme, useNow } from './nook';
import { resetDemo } from './data/demoApi';
import { useStore } from './data/store';
import { useIdleLock, usePhone, useWakeLock } from './lib/device';
import { Chores } from './screens/Chores';
import { Home } from './screens/Home';
import { PlanEditor } from './screens/PlanEditor';
import { Shopping } from './screens/Shopping';
import { Tasks } from './screens/Tasks';

type Route = 'home' | 'chores' | 'tasks' | 'shop' | 'plan';
// Older builds kept the PIN in localStorage. It now lives in memory only: forget any copy left behind.
try { localStorage.removeItem('nook.tasksPin'); } catch { /* storage off */ }

export function App() {
  const store = useStore();
  const now = useNow();
  const phone = usePhone();
  const [chosen, setRoute] = useState<Route>('home');
  const route: Route = phone && chosen === 'plan' ? 'home' : chosen;   // the plan editor needs the big screen
  /** The household PIN while the private lists are open on the tablet. Never stored. */
  const [pin, setPin] = useState<string | null>(null);
  const lock = useCallback(() => setPin(null), []);
  const [forceTheme, setForceTheme] = useState<'light' | 'dark' | null>(null);

  useAutoTheme({ force: forceTheme });
  useWakeLock();
  useIdleLock(!!pin, lock);   // private lists close after 60 s without a touch, and when the screen sleeps

  const chores = store.data?.chores;
  const due = useMemo(() => (chores ?? []).filter((c) => choreHeat(c, now) >= 2).length, [chores, now]);

  if (store.error && !store.data) {
    return <div style={{ padding: 48 }}><h1 className="nk-h1">Couldn't load Nook</h1><p>{store.error}</p><Button onClick={store.refresh}>Try again</Button></div>;
  }
  if (!store.data) return <div style={{ height: '100vh', display: 'grid', placeItems: 'center', color: 'var(--ink-muted)' }}>Loading…</div>;

  return (
    <div className="nk-screen">
      <NavRail value={route} onChange={(r) => setRoute(r as Route)}
        top={<div style={{ textAlign: 'center' }}>nook{store.mode === 'demo' && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: 0 }}>DEMO</div>}</div>}
        items={[
          { id: 'home', label: 'Home', icon: 'home' },
          { id: 'chores', label: 'Chores', icon: 'sparkle', badge: due || undefined },
          { id: 'tasks', label: 'Tasks', icon: 'list' },
          { id: 'shop', label: 'Shopping', icon: 'cart' },
          ...(phone ? [] : [{ id: 'plan', label: 'Plan', icon: 'plan' as const }]),
        ]}
        footer={<>
          {pin && <IconButton icon="lock" label="Lock private lists" onClick={lock} />}
          <Button variant="ghost" style={{ minHeight: 44, padding: '0 8px', fontSize: 13 }}
            title="Theme: auto → light → dark"
            onClick={() => setForceTheme(forceTheme === null ? 'light' : forceTheme === 'light' ? 'dark' : null)}>
            {forceTheme ?? 'auto'}
          </Button>
          {store.mode === 'demo' && <Button variant="ghost" style={{ minHeight: 40, padding: '0 8px', fontSize: 13 }} onClick={() => { resetDemo(); location.reload(); }}>Reset</Button>}
        </>}
      />
      <div className="app-body">
        {route === 'home' && <Home />}
        {route === 'chores' && <Chores />}
        {route === 'tasks' && <Tasks pin={pin} onUnlock={setPin} onLock={lock} />}
        {route === 'shop' && <Shopping />}
        {route === 'plan' && <PlanEditor />}
      </div>

      {store.toast && (
        <div className="nk-toast-slot">
          <Toast key={store.toast.id} icon={store.toast.icon ?? 'check'} message={store.toast.message}
            actionLabel={store.toast.undo ? 'Undo' : undefined} onAction={() => { store.toast?.undo?.(); store.setToast(null); }}
            onDismiss={() => store.setToast(null)} />
        </div>
      )}
    </div>
  );
}
