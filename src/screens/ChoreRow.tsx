import { ChoreCard, choreHeat, heatLabel, type Chore, type IconName } from '../nook';
import { useStore } from '../data/store';
import { scheduleText } from '../lib/where';

/** Let the card's swipe-away animation play before the list re-sorts. */
const SWIPE_MS = 260;

/** A chore in a list: swipe right for done, left to snooze, tap to open. */
export function ChoreRow({ chore: c, where, now, onOpen }: { chore: Chore; where: string; now: Date; onOpen: (id: string) => void }) {
  const store = useStore();
  return (
    <ChoreCard
      // a fresh card after done / snooze, so a swiped-away card doesn't stay swiped
      key={c.id + (c.last_done_at ?? '') + (c.snoozed_until ?? '')}
      title={c.title} room={where} schedule={scheduleText(c)} level={choreHeat(c, now)} badge={heatLabel(c, now)} icon={(c.icon as IconName) ?? undefined}
      uses={c.use_limit && c.use_limit > 1 ? { count: c.uses ?? 0, limit: c.use_limit } : undefined}
      onComplete={() => window.setTimeout(() => store.completeChore(c), SWIPE_MS)}
      onSnooze={() => window.setTimeout(() => store.snoozeChore(c), SWIPE_MS)}
      onOpen={() => onOpen(c.id)} />
  );
}
