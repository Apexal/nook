import { useEffect, useState } from 'react';

/** Phone-sized screens: no floorplan, a bottom tab bar, one column. Matches the media query in app.css. */
export const PHONE_QUERY = '(max-width: 720px), (max-height: 500px)';

export function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

/** Keep the tablet's screen on while Nook is visible (Screen Wake Lock API). Phones are left to sleep as usual. */
export function useWakeLock() {
  useEffect(() => {
    if (window.matchMedia(PHONE_QUERY).matches) return;
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    const request = async () => { try { lock = (await nav.wakeLock?.request('screen')) ?? null; } catch { /* not allowed right now */ } };
    const onVis = () => { if (document.visibilityState === 'visible') request(); };
    request();
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}); };
  }, []);
}

/** Call `onIdle` after `ms` without a touch or key press, and as soon as the screen sleeps or the app is hidden. */
export function useIdleLock(active: boolean, onIdle: () => void, ms = 60000) {
  useEffect(() => {
    if (!active) return;
    let t = window.setTimeout(onIdle, ms);
    const touch = () => { window.clearTimeout(t); t = window.setTimeout(onIdle, ms); };
    const onVis = () => { if (document.visibilityState === 'hidden') onIdle(); };
    window.addEventListener('pointerdown', touch, true);
    window.addEventListener('keydown', touch, true);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', touch, true);
      window.removeEventListener('keydown', touch, true);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, onIdle, ms]);
}
