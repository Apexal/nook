import { useState } from 'react';

export function cx(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(' '); }

/** Controlled when `value` is defined, uncontrolled (starting at `initial`) otherwise. */
export function useControlled<T>(value: T | undefined, initial: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState<T>(initial);
  const controlled = value !== undefined;
  return [controlled ? (value as T) : inner, (v: T) => { if (!controlled) setInner(v); onChange?.(v); }];
}
