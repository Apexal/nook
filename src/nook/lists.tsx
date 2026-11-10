import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { HEAT_WORDS } from './heat';
import { QuickAdd } from './controls';
import { HeatBadge, UseMeter, heatIcon } from './status';
import type { HeatLevel } from './types';
import { cx, useControlled } from './util';

/* ---------------- ChoreCard ---------------- */
export interface ChoreCardProps {
  title: string;
  /** Where: "Master bedroom", "Kitchen · Fridge" */
  room?: string;
  /** How often: "Every week", "After each use" */
  schedule?: string;
  level: HeatLevel;
  /** Badge text override, e.g. "Overdue · 4d" */
  badge?: string;
  icon?: IconName;
  /** Use-based chores show a compact meter on the right. */
  uses?: { count: number; limit: number };
  selected?: boolean;
  onOpen?: () => void;
  onComplete?: () => void;
  onSnooze?: () => void;
  /** Demo: starting offset in px (positive shows Done, negative Snooze). */
  peek?: number;
  /** Demo: spring back this many ms after a commit. */
  resetAfter?: number;
  className?: string;
}
/** A chore in a list. Swipe right = done, left = snooze to tomorrow, tap = open. */
export function ChoreCard({ title, room, schedule, level, badge, icon, uses, selected, onOpen, onComplete, onSnooze, peek = 0, resetAfter, className }: ChoreCardProps) {
  const [dx, setDx] = useState(peek);
  const [anim, setAnim] = useState(false);
  const [result, setResult] = useState<null | 'done' | 'snoozed'>(null);
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<null | { x: number; y: number; start: number; axis: null | 'x'; id: number }>(null);
  const moved = useRef(false);
  const width = () => el.current?.offsetWidth ?? 400;

  const commit = (to: number, res: 'done' | 'snoozed') => {
    setAnim(true); setDx(to); setResult(res);
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
    if (res === 'done') onComplete?.(); else onSnooze?.();
    if (resetAfter) setTimeout(() => { setAnim(true); setDx(0); setResult(null); }, resetAfter);
  };
  const side = dx > 0 ? 'done' : dx < 0 ? 'snooze' : undefined;

  return (
    <div ref={el} className={cx('nk-chore', selected && 'is-selected', result === 'done' && 'is-done', result === 'snoozed' && 'is-snoozed', className)} data-side={side}>
      <div className="nk-chore__under" aria-hidden="true">
        <span className="nk-chore__under-done"><Icon name="check" size={28} strokeWidth={2.6} />{result === 'done' ? 'Done!' : 'Done'}</span>
        <span className="nk-chore__under-snooze">{result === 'snoozed' ? 'Tomorrow' : 'Snooze'}<Icon name="clock" size={28} /></span>
      </div>
      <div
        className={cx('nk-chore__face', anim && 'is-anim', dx !== 0 && 'is-lifted')}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        role="button" tabIndex={0} aria-label={`${title}, ${room ?? ''}, ${HEAT_WORDS[level]}`}
        onPointerDown={(e) => { if (result) return; drag.current = { x: e.clientX, y: e.clientY, start: dx, axis: null, id: e.pointerId }; moved.current = false; setAnim(false); }}
        onPointerMove={(e) => {
          const d = drag.current; if (!d) return;
          const mx = e.clientX - d.x, my = e.clientY - d.y;
          if (!d.axis) {
            if (Math.abs(mx) > 8) { d.axis = 'x'; try { (e.currentTarget as HTMLElement).setPointerCapture(d.id); } catch { /* ignore */ } }
            else if (Math.abs(my) > 8) { drag.current = null; return; } else return;
          }
          moved.current = true; const w = width(); setDx(Math.max(-w, Math.min(w, d.start + mx)));
        }}
        onPointerUp={() => {
          if (!drag.current) return; drag.current = null; const w = width();
          if (dx > w * 0.35) commit(w, 'done'); else if (dx < -w * 0.35) commit(-w, 'snoozed'); else { setAnim(true); setDx(0); }
        }}
        onPointerCancel={() => { drag.current = null; setAnim(true); setDx(0); }}
        onClick={() => { if (!moved.current && !dx) onOpen?.(); moved.current = false; }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); } }}
      >
        <span className={cx('nk-chore__tile', `nk-heat-bg-${level}`, level >= 3 && 'nk-hatch')}><Icon name={icon ?? heatIcon(level)} size={26} /></span>
        <span className="nk-chore__text">
          <span className="nk-chore__title">{title}</span>
          <span className="nk-chore__metarow">
            {level > 0 && <HeatBadge level={level} label={badge} />}
            <span className="nk-chore__meta">{[room, schedule].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
        {uses && <span className="nk-chore__end"><UseMeter compact uses={uses.count} limit={uses.limit} /></span>}
      </div>
    </div>
  );
}

/* ---------------- TaskItem ---------------- */
export interface TaskItemProps {
  title: string; meta?: string; late?: boolean;
  done?: boolean; defaultDone?: boolean; onToggle?: (done: boolean) => void;
  /** Shopping: quantity badge, e.g. 2 → "×2" */
  qty?: number | string;
  end?: ReactNode;
  className?: string;
}
export function TaskItem({ title, meta, late, done, defaultDone = false, onToggle, qty, end, className }: TaskItemProps) {
  const [on, setOn] = useControlled(done, defaultDone, onToggle);
  return (
    <label className={cx('nk-task', className)}>
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <span className="nk-task__check"><Icon name="check" size={20} strokeWidth={3} /></span>
      <span className="nk-task__text">
        <span className="nk-task__title">{title}</span>
        {meta && <span className={cx('nk-task__meta', late && 'is-late')}>{meta}</span>}
      </span>
      {qty != null && qty !== 1 && <span className="nk-qty">×{qty}</span>}
      {end}
    </label>
  );
}

/* ---------------- TaskGroup ---------------- */
export interface TaskGroupProps {
  title: string; icon?: IconName;
  /** Private list tint: a = Frank, b = Sarah. Omit for shared categories. */
  person?: 'a' | 'b';
  count?: number;
  actions?: ReactNode;
  children?: ReactNode;
  /** Shows an inline "Add a task" row. */
  onAdd?: (text: string) => void;
  addPlaceholder?: string;
  /** Completed items, tucked into a collapsible "Done" row. */
  done?: ReactNode; doneCount?: number; doneLabel?: string;
  className?: string;
}
export function TaskGroup({ title, icon = 'folder', person, count, actions, children, onAdd, addPlaceholder = 'Add a task', done, doneCount, doneLabel = 'Done', className }: TaskGroupProps) {
  return (
    <section className={cx('nk-group', person && `nk-group--${person}`, className)}>
      <header className="nk-group__head">
        <span className="nk-group__icon"><Icon name={icon} /></span>
        <h3 className="nk-group__title">{title}</h3>
        {count != null && <span className="nk-group__count">{count}</span>}
        {actions}
      </header>
      <div className="nk-group__body">{children}</div>
      {onAdd && <QuickAdd inline placeholder={addPlaceholder} onAdd={onAdd} />}
      {done && (
        <details className="nk-done-section">
          <summary><Icon name="chevron-right" size={20} />{doneLabel}{doneCount != null ? ` (${doneCount})` : ''}</summary>
          {done}
        </details>
      )}
    </section>
  );
}

/* ---------------- Toast ---------------- */
export interface ToastProps { message: ReactNode; icon?: IconName; actionLabel?: string; onAction?: () => void; /** ms before onDismiss fires (default 5000; 0 = stay) */ timeout?: number; onDismiss?: () => void; className?: string }
export function Toast({ message, icon = 'check', actionLabel, onAction, timeout = 5000, onDismiss, className }: ToastProps) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (!timeout) return;
    const t = setTimeout(() => dismiss.current?.(), timeout);
    return () => clearTimeout(t);
  }, [timeout, message]);
  return (
    <div className={cx('nk-toast', className)} role="status">
      {icon && <span className="nk-toast__icon"><Icon name={icon} size={20} strokeWidth={2.6} /></span>}
      <span className="nk-toast__msg">{message}</span>
      {actionLabel && <button type="button" className="nk-toast__action" onClick={onAction}><Icon name="undo" size={20} />{actionLabel}</button>}
    </div>
  );
}
