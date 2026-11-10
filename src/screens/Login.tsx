import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button, TextField } from '../nook';

/** Shown once per device. The tablet signs in as the household account; phones as Frank or Sarah. */
export function Login({ sb }: { sb: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--surface-100)' }}>
      <form onSubmit={submit} className="nk-group" style={{ width: 'min(420px, calc(100vw - 32px))', boxSizing: 'border-box', padding: 'clamp(20px, 6vw, 32px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 800, letterSpacing: '-.02em' }}>nook</div>
        <p style={{ margin: 0, color: 'var(--ink-muted)' }}>Sign in once on this device. The tablet uses the household account.</p>
        <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required error={error ?? undefined} />
        <Button type="submit" size="lg" icon="check" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </div>
  );
}
