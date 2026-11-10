import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import './nook/tokens.css';
import './nook/nook.css';
import './app.css';
import { App } from './App';
import { demoApi } from './data/demoApi';
import { NookProvider } from './data/store';
import { supabaseApi } from './data/supabaseApi';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';

/** Supabase when keys are configured (sign in once per device), otherwise demo mode. */
function Root() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const userId = session?.user.id;
  // keyed on the user, not the session object, which changes on every token refresh
  const api = useMemo(() => (supabase ? (userId ? supabaseApi(supabase, userId) : null) : demoApi()), [userId]);

  if (supabase && session === undefined) return null;
  if (supabase && !session) return <Login sb={supabase} />;
  return <NookProvider api={api!} key={userId ?? 'demo'}><App /></NookProvider>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
