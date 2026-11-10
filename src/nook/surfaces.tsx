import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { IconButton } from './controls';
import { cx, useControlled } from './util';

/* ---------------- Sheet ---------------- */
export interface SheetProps {
  title: string; eyebrow?: string; subtitle?: ReactNode;
  children?: ReactNode; footer?: ReactNode;
  open?: boolean; onClose?: () => void;
  /** Render in flow (no scrim, no fixed position), e.g. as the home screen's right column. */
  inline?: boolean;
  className?: string;
}
/** Right-hand side sheet (460px) for chore, room, item and task details. */
export function Sheet({ title, eyebrow, subtitle, children, footer, open = true, onClose, inline, className }: SheetProps) {
  if (!open) return null;
  const panel = (
    <section className={cx('nk-sheet', inline && 'nk-sheet--inline', className)} role="dialog" aria-label={title}>
      <header className="nk-sheet__head">
        <div className="nk-sheet__titles">
          {eyebrow && <div className="nk-sheet__eyebrow">{eyebrow}</div>}
          <h2 className="nk-sheet__title">{title}</h2>
          {subtitle && <div className="nk-sheet__sub">{subtitle}</div>}
        </div>
        {onClose && <IconButton icon="close" label="Close" variant="soft" onClick={onClose} />}
      </header>
      <div className="nk-sheet__body">{children}</div>
      {footer && <footer className="nk-sheet__foot">{footer}</footer>}
    </section>
  );
  if (inline) return panel;
  return <div className="nk-sheet-layer"><div className="nk-scrim" onClick={onClose} />{panel}</div>;
}

/* ---------------- NavRail ---------------- */
export interface NavItem { id: string; label: string; icon: IconName; badge?: number }
export interface NavRailProps { items: NavItem[]; value?: string; defaultValue?: string; onChange?: (id: string) => void; top?: ReactNode; footer?: ReactNode; className?: string }
export function NavRail({ items, value, defaultValue, onChange, top = 'nook', footer, className }: NavRailProps) {
  const [cur, setCur] = useControlled(value, defaultValue ?? items[0]?.id, onChange);
  return (
    <nav className={cx('nk-rail', className)} aria-label="Main">
      {top && <div className="nk-rail__top">{top}</div>}
      <div className="nk-rail__items">
        {items.map((it) => (
          <button key={it.id} type="button" className="nk-rail__item" aria-current={it.id === cur ? 'page' : undefined} onClick={() => setCur(it.id)}>
            <span className="nk-rail__pill"><Icon name={it.icon} size={28} />{it.badge ? <span className="nk-rail__badge">{it.badge}</span> : null}</span>
            <span className="nk-rail__label">{it.label}</span>
          </button>
        ))}
      </div>
      {footer && <div className="nk-rail__foot">{footer}</div>}
    </nav>
  );
}
