import { useEffect, useState } from 'react';

export type ThemeName = 'light' | 'dark';

function mins(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); }

/** Which theme a clock time falls in. Defaults: light from 07:00, dark from 20:30. */
export function themeAt(date: Date, light = '07:00', dark = '20:30'): ThemeName {
  const m = date.getHours() * 60 + date.getMinutes(), L = mins(light), D = mins(dark);
  const isDark = L < D ? (m < L || m >= D) : (m >= D && m < L);
  return isDark ? 'dark' : 'light';
}

/** Set data-theme on <html>, cross-fading colours for 600ms (skipped on first paint). */
export function applyTheme(theme: ThemeName, fade = true) {
  const html = document.documentElement;
  if (html.getAttribute('data-theme') === theme) return;
  if (fade) html.classList.add('nk-theme-fade');
  html.setAttribute('data-theme', theme);
  if (fade) window.setTimeout(() => html.classList.remove('nk-theme-fade'), 700);
}

/** Switch to dark at night automatically. Re-checks every minute. Call once at the app root. */
export function useAutoTheme(opts: { light?: string; dark?: string; force?: ThemeName | null } = {}) {
  const { light = '07:00', dark = '20:30', force = null } = opts;
  useEffect(() => {
    const tick = (fade: boolean) => applyTheme(force ?? themeAt(new Date(), light, dark), fade);
    tick(false);
    const id = window.setInterval(() => tick(true), 60000);
    return () => window.clearInterval(id);
  }, [light, dark, force]);
}

/** The current time, refreshed every `ms` (default one minute), so heat moves on its own. */
export function useNow(ms = 60000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), ms); return () => window.clearInterval(id); }, [ms]);
  return now;
}
