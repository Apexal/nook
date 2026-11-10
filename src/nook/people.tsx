import { useRef, useState } from 'react';
import { Icon } from './Icon';
import type { Person } from './types';
import { cx } from './util';

/* ---------------- Avatar ---------------- */
export interface AvatarProps {
  name: string;
  /** a = Frank (green), b = Sarah (pink), home = shared */
  person?: Person;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Show a small lock (private list closed) or unlock badge. */
  lock?: 'locked' | 'open';
  /** Render as a button (e.g. tap your face to open your private list). */
  onClick?: () => void;
  open?: boolean;
  className?: string;
}
export function Avatar({ name, person = 'home', size = 'md', lock, onClick, open, className }: AvatarProps) {
  const face = (
    <span className={cx('nk-avatar', `nk-avatar--${person}`, `nk-avatar--${size}`, !onClick && className)} role={onClick ? undefined : 'img'} aria-label={onClick ? undefined : name} title={name}>
      {person === 'home' ? <Icon name="home" size={size === 'sm' ? 16 : 20} /> : name.trim().charAt(0).toUpperCase()}
      {lock && <span className="nk-avatar__lock"><Icon name={lock === 'locked' ? 'lock' : 'unlock'} size={14} strokeWidth={2.4} /></span>}
    </span>
  );
  if (!onClick) return face;
  return (
    <button type="button" className={cx('nk-avatar-btn', person !== 'home' && `nk-avatar-btn--${person}`, open && 'is-open', className)} onClick={onClick}
      aria-label={lock === 'locked' ? `Open ${name}'s list` : name} aria-pressed={open}>
      {face}
    </button>
  );
}

/* ---------------- PinPad ---------------- */
export interface PinPadProps {
  name: string;
  /** Whose face to show; 'home' for the shared household lock. */
  person: Person;
  /** Line under the face. Defaults to "Hi {name}". */
  greeting?: string;
  length?: number;
  /** Return true (or a Promise of true) when the PIN is right; false shakes the dots and clears. */
  onComplete: (pin: string) => boolean | Promise<boolean>;
  /** Leave out to hide the Cancel key (e.g. when the keypad is the whole screen). */
  onCancel?: () => void;
  className?: string;
}
/** Big round keypad that unlocks Tasks on the shared tablet. */
export function PinPad({ name, person, greeting, length = 4, onComplete, onCancel, className }: PinPadProps) {
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  // ignore keys while a full PIN is being checked, so fast taps can't submit it twice
  const checking = useRef(false);
  const press = async (k: string) => {
    if (wrong || checking.current) return;
    if (k === 'del') { setCode(code.slice(0, -1)); return; }
    const next = (code + k).slice(0, length);
    setCode(next);
    if (next.length === length) {
      checking.current = true;
      let ok = false;
      try { ok = await onComplete(next); } finally { checking.current = false; }
      if (ok) setTimeout(() => setCode(''), 300);
      else { setWrong(true); setTimeout(() => { setWrong(false); setCode(''); }, 650); }
    }
  };
  return (
    <div className={cx('nk-pin', wrong && 'is-wrong', className)} role="dialog" aria-label={`PIN for ${name}`}>
      <div className="nk-pin__who"><Avatar name={name} person={person} size="lg" />{greeting ?? `Hi ${name}`}</div>
      <div className="nk-pin__dots" aria-live="polite" aria-label={`${code.length} of ${length} digits`}>
        {Array.from({ length }, (_, i) => <i key={i} className={i < code.length ? 'is-on' : undefined} />)}
      </div>
      <div className="nk-pin__msg">{wrong ? 'Not quite. Try again.' : 'Enter your PIN'}</div>
      <div className="nk-pin__keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" onClick={() => press(k)}>{k}</button>)}
        {onCancel ? <button type="button" className="is-quiet" onClick={onCancel}>Cancel</button> : <span />}
        <button type="button" onClick={() => press('0')}>0</button>
        <button type="button" className="is-quiet" aria-label="Delete" onClick={() => press('del')}><Icon name="delete" size={28} /></button>
      </div>
    </div>
  );
}
