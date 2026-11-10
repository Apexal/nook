import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Avatar } from './people';
import type { Floor, HeatLevel, Person } from './types';
import { cx, useControlled } from './util';

/* ---------------- Button ---------------- */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
  /** md = 56px, lg = 72px */
  size?: 'md' | 'lg';
  icon?: IconName; iconRight?: IconName; block?: boolean;
}
export function Button({ variant = 'primary', size = 'md', icon, iconRight, block, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" {...rest} className={cx('nk-btn', `nk-btn--${variant}`, size === 'lg' && 'nk-btn--lg', block && 'nk-btn--block', className)}>
      {icon && <Icon name={icon} />}
      {children != null && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} />}
    </button>
  );
}

/* ---------------- IconButton ---------------- */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName; /** Required accessible name, also the tooltip. */ label: string;
  variant?: 'ghost' | 'soft' | 'outline' | 'filled'; size?: 'md' | 'lg';
}
export function IconButton({ icon, label, variant = 'ghost', size = 'md', className, ...rest }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={cx('nk-iconbtn', `nk-iconbtn--${variant}`, size === 'lg' && 'nk-iconbtn--lg', className)}>
      <Icon name={icon} size={size === 'lg' ? 28 : 24} />
    </button>
  );
}

/* ---------------- TextField ---------------- */
export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; error?: string; icon?: IconName }
export function TextField({ label, hint, error, icon, className, ...input }: TextFieldProps) {
  const id = useId();
  return (
    <label className={cx('nk-field', error && 'is-invalid', className)} htmlFor={id}>
      {label && <span className="nk-field-label">{label}</span>}
      <span className="nk-input-wrap">{icon && <Icon name={icon} />}<input id={id} className="nk-input" {...input} /></span>
      {(error || hint) && <span className="nk-field__hint">{error || hint}</span>}
    </label>
  );
}

/* ---------------- QuickAdd ---------------- */
export interface QuickAddProps { placeholder?: string; buttonLabel?: string; icon?: IconName; inline?: boolean; onAdd: (text: string) => void; className?: string }
/** One-line "type and add" pill. Enter or the button adds; the field clears and keeps focus. */
export function QuickAdd({ placeholder = 'Add…', buttonLabel = 'Add', icon = 'plus', inline, onAdd, className }: QuickAddProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const submit = () => { const t = text.trim(); if (!t) return; onAdd(t); setText(''); ref.current?.focus(); };
  return (
    <form className={cx('nk-quickadd', inline && 'nk-quickadd--inline', className)} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Icon name={icon} />
      <input ref={ref} className="nk-input" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} enterKeyHint="done" />
      {!inline && <button type="submit" className="nk-btn nk-btn--primary" disabled={!text.trim()}>{buttonLabel}</button>}
    </form>
  );
}

/* ---------------- Stepper ---------------- */
export interface StepperProps { value?: number; defaultValue?: number; min?: number; max?: number; step?: number; /** "weeks" or ["week", "weeks"] */ unit?: string | [string, string]; label?: string; onChange?: (v: number) => void; className?: string }
export function Stepper({ value, defaultValue = 1, min = 0, max = 999, step = 1, unit, label, onChange, className }: StepperProps) {
  const [v, setV] = useControlled(value, defaultValue, onChange);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const u = Array.isArray(unit) ? (v === 1 ? unit[0] : unit[1]) : unit;
  const body = (
    <div className={cx('nk-stepper', className)} role="group" aria-label={label}>
      <button type="button" aria-label="Less" disabled={v <= min} onClick={() => setV(clamp(v - step))}><Icon name="minus" /></button>
      <input type="number" inputMode="numeric" value={v} min={min} max={max} aria-label={label} onChange={(e) => setV(clamp(+e.target.value || 0))} />
      {u && <span className="nk-stepper__unit">{u}</span>}
      <button type="button" aria-label="More" disabled={v >= max} onClick={() => setV(clamp(v + step))}><Icon name="plus" /></button>
    </div>
  );
  return label ? <div className="nk-field"><span className="nk-field-label">{label}</span>{body}</div> : body;
}

/* ---------------- Select ---------------- */
export interface SelectOption { value: string; label: string; description?: string; icon?: IconName; person?: Person; heat?: HeatLevel; material?: Floor }
export interface SelectProps { options: SelectOption[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; label?: string; placeholder?: string; defaultOpen?: boolean; block?: boolean; up?: boolean; className?: string }
function Lead({ o }: { o?: SelectOption }) {
  if (!o) return null;
  if (o.person) return <Avatar name={o.label} person={o.person} size="sm" />;
  if (o.heat != null) return <span className={cx('nk-swatch', `nk-heat-bg-${o.heat}`, o.heat >= 3 && 'nk-hatch')} />;
  if (o.material) return <span className={cx('nk-swatch', `nk-mat-${o.material}`)} />;
  if (o.icon) return <Icon name={o.icon} />;
  return null;
}
/** Touch dropdown: 56px trigger, 56px options, check on the current one. */
export function Select({ options, value, defaultValue, onChange, label, placeholder = 'Choose…', defaultOpen, block, up, className }: SelectProps) {
  const [cur, setCur] = useControlled<string | undefined>(value, defaultValue, onChange as (v: string | undefined) => void);
  const [open, setOpen] = useState(!!defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const sel = options.find((o) => o.value === cur);
  return (
    <div ref={ref} className={cx('nk-select', block && 'nk-select--block', up && 'nk-select--up', open && 'is-open', className)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      {label && <span className="nk-field-label">{label}</span>}
      <button type="button" className="nk-select__trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Lead o={sel} />
        <span className="nk-select__value" data-placeholder={placeholder}>{sel ? sel.label : ''}</span>
        <Icon name="chevron-down" className="nk-select__chev" />
      </button>
      {open && (
        <ul className="nk-select__menu" role="listbox">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === cur} className="nk-select__opt" onClick={() => { setCur(o.value); setOpen(false); }}>
              <Lead o={o} />
              <span className="nk-select__opt-text"><span className="nk-select__label">{o.label}</span>{o.description && <span className="nk-select__desc">{o.description}</span>}</span>
              <Icon name="check" className="nk-select__check" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- SegmentedControl ---------------- */
export interface SegmentOption { value: string; label: string; icon?: IconName; person?: 'a' | 'b' }
export interface SegmentedControlProps { options: SegmentOption[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; label?: string; block?: boolean; className?: string }
export function SegmentedControl({ options, value, defaultValue, onChange, label, block, className }: SegmentedControlProps) {
  const name = useId();
  const [cur, setCur] = useControlled(value, defaultValue ?? options[0]?.value, onChange);
  return (
    <div className={cx('nk-seg', block && 'nk-seg--block', className)} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value} className="nk-seg__opt">
          <input type="radio" name={name} value={o.value} checked={o.value === cur} onChange={() => setCur(o.value)} />
          <span>{o.icon && <Icon name={o.icon} />}{o.person && <span className={`nk-dot nk-dot--${o.person}`} />}{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ---------------- Chip ---------------- */
export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> { selected?: boolean; icon?: IconName; person?: 'a' | 'b'; heat?: HeatLevel; count?: number; children?: ReactNode }
/** Toggle filter (or a one-tap suggestion when used without `selected`). */
export function Chip({ selected, icon, person, heat, count, className, children, ...rest }: ChipProps) {
  return (
    <button type="button" aria-pressed={selected} {...rest} className={cx('nk-chip', selected && 'is-on', className)}>
      <span className="nk-chip__body">
        <Icon name="check" size={20} className="nk-chip__check" />
        {icon && <Icon name={icon} size={20} className="nk-chip__lead" />}
        {person && <span className={`nk-dot nk-dot--${person}`} />}
        {heat != null && <span className={cx('nk-swatch nk-swatch--sm', `nk-heat-bg-${heat}`)} />}
        <span>{children}</span>
        {count != null && <span className="nk-chip__count">{count}</span>}
      </span>
    </button>
  );
}
