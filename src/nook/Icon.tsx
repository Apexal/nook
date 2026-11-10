import type { CSSProperties } from 'react';

export const ICONS = {
  home: 'M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z',
  plan: 'M4 4h16v16H4z M4 13h7 M11 4v16 M15 13h5',
  list: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z M4 10h16 M8.5 3v4 M15.5 3v4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17z M12 7.5V12l3 2',
  alert: 'M12 8.5v4.5 M12 16.5h.01 M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  close: 'M6.5 6.5l11 11 M17.5 6.5l-11 11',
  'chevron-down': 'M6 9.5l6 6 6-6',
  'chevron-right': 'M9.5 6l6 6-6 6',
  pencil: 'M4 20h4.2L19.4 8.8a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8z M13.5 6.5l4 4',
  undo: 'M9 14.5 4 9.5l5-5 M4 9.5h10a6 6 0 0 1 0 12h-3',
  trash: 'M4 7h16 M9.5 7V4.5h5V7 M6 7l1 13h10l1-13 M10 11v5 M14 11v5',
  move: 'M12 3v18 M3 12h18 M9 6l3-3 3 3 M9 18l3 3 3-3 M6 9l-3 3 3 3 M18 9l3 3-3 3',
  rotate: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3 M19.5 4v5h-5',
  flip: 'M12 3v18 M8 7 4 12l4 5z M16 7l4 5-4 5z',
  grid: 'M4 4h16v16H4z M4 12h16 M12 4v16',
  sparkle: 'M12 3.5c.6 4 2.5 5.9 6.5 6.5-4 .6-5.9 2.5-6.5 6.5-.6-4-2.5-5.9-6.5-6.5 4-.6 5.9-2.5 6.5-6.5z M18.5 15.5v4 M16.5 17.5h4',
  drop: 'M12 3.5c3 4.2 6 7.4 6 10.9a6 6 0 0 1-12 0c0-3.5 3-6.7 6-10.9z',
  user: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4.5 20.5c1.4-3.6 4.3-5.5 7.5-5.5s6.1 1.9 7.5 5.5',
  dot: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
  cart: 'M3 4.5h2.5l2.2 10h10.1L20 7.5H6.4 M9.5 19.5h.01 M16.5 19.5h.01',
  tag: 'M3.5 12.3V4.5h7.8l9 9-7.8 7.8z M8 8.5h.01',
  folder: 'M3.5 6.5A1.5 1.5 0 0 1 5 5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  leaf: 'M5 19c0-9 5.5-14 15-14 0 9.5-5 15-14 15 M5 19l7-7',
  wrench: 'M15 4a5 5 0 0 0-4.6 6.9L4 17.3 6.7 20l6.4-6.4A5 5 0 0 0 20 9l-3 1-2-2 1-3z',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  tally: 'M6.5 5v14 M10.5 5v14 M14.5 5v14 M18.5 5v14 M4 15.5l16-7',
  door: 'M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16 M3.5 20.5h17 M14.5 12.5h.01',
  delete: 'M9 5h11v14H9l-6-7z M12.5 9.5l5 5 M17.5 9.5l-5 5',
} as const;

export type IconName = keyof typeof ICONS;
export const iconNames = Object.keys(ICONS) as IconName[];

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; title?: string; className?: string; style?: CSSProperties }

/** Nook line icon: 24px grid, 2px round stroke, currentColor. */
export function Icon({ name, size = 24, strokeWidth = 2, title, className, style }: IconProps) {
  return (
    <svg className={['nk-icon', className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={ICONS[name] ?? ICONS.dot} />
    </svg>
  );
}
