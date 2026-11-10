import { Icon, type IconName } from './Icon';
import { HEAT_WORDS, heatLevel } from './heat';
import type { HeatLevel } from './types';
import { cx } from './util';

const HEAT_ICONS: IconName[] = ['check', 'clock', 'dot', 'alert', 'alert'];

/* ---------------- HeatBadge ---------------- */
export interface HeatBadgeProps { level: HeatLevel; /** e.g. "Overdue · 4d" */ label?: string; size?: 'md' | 'lg'; className?: string }
export function HeatBadge({ level, label, size = 'md', className }: HeatBadgeProps) {
  return (
    <span className={cx('nk-heat', `nk-heat-bg-${level}`, level >= 3 && 'nk-hatch', size === 'lg' && 'nk-heat--lg', className)}>
      <Icon name={HEAT_ICONS[level]} size={size === 'lg' ? 20 : 16} strokeWidth={2.4} />
      <span>{label ?? HEAT_WORDS[level]}</span>
    </span>
  );
}
export const heatIcon = (l: HeatLevel) => HEAT_ICONS[l];

/* ---------------- HeatLegend ---------------- */
export interface HeatLegendProps { levels?: HeatLevel[]; vertical?: boolean; className?: string }
export function HeatLegend({ levels = [0, 1, 2, 3, 4], vertical, className }: HeatLegendProps) {
  return (
    <div className={cx('nk-legend', vertical && 'nk-legend--v', className)}>
      {levels.map((l) => (
        <span key={l} className="nk-legend__item"><span className={cx('nk-swatch', `nk-heat-bg-${l}`, l >= 3 && 'nk-hatch')} />{HEAT_WORDS[l]}</span>
      ))}
    </div>
  );
}

/* ---------------- UseMeter ---------------- */
export interface UseMeterProps { uses: number; limit: number; onAdd?: () => void; compact?: boolean; className?: string }
/** Progress toward a use-based chore ("clean after 30 coffees"). Dots up to 8, a bar beyond. */
export function UseMeter({ uses, limit, onAdd, compact, className }: UseMeterProps) {
  const lvl = heatLevel({ uses, useLimit: limit });
  const fill = `nk-heat-bg-${Math.max(lvl, 1)}`;
  return (
    <div className={cx('nk-uses', compact && 'nk-uses--compact', className)}>
      {limit <= 8 && !compact
        ? <span className="nk-uses__dots" aria-hidden="true">{Array.from({ length: limit }, (_, i) => <i key={i} className={i < uses ? cx('is-on', fill) : undefined} />)}</span>
        : <span className="nk-uses__bar" aria-hidden="true"><span className={fill} style={{ ['--p' as string]: `${Math.min(100, (uses / limit) * 100)}%` }} /></span>}
      <span className="nk-uses__count"><b>{uses}</b>{compact ? `/${limit}` : ` of ${limit} use${limit === 1 ? '' : 's'}`}</span>
      {onAdd && <button type="button" className="nk-btn nk-btn--soft" onClick={onAdd}><Icon name="plus" size={20} /><span>1 use</span></button>}
    </div>
  );
}
