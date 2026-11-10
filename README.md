# Nook

The shared home screen for Frank and Sarah: a floorplan that glows where chores are due, shared and private task lists, and a shopping list. It runs on a landscape Android tablet on the kitchen counter, built with React 18, Vite and Supabase.

## Try it now (demo mode)

```bash
npm install
npm run dev
```

With no Supabase keys, Nook runs on the sample apartment. Data is saved in the browser's localStorage. Both private-list PINs are **1234**. **Reset** in the rail brings the demo back to its starting state.

## Connect Supabase

1. Create a Supabase project. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API; the older `VITE_SUPABASE_ANON_KEY` name works too).
2. Run the migrations, either `supabase db push` with the CLI or by pasting each file in `supabase/migrations/` into the SQL editor, oldest first.
3. Optional demo data: paste `supabase/seed.sql` into the SQL editor. It creates the household (`00000000-0000-4000-8000-000000000001`), the sample plan, chores, task categories and a shopping list.
4. In Authentication → Users, create three users: Frank, Sarah and the tablet (for example `tablet@yourdomain`). Then link them to the household and set the shared PIN, which opens both private lists on the tablet:

   ```sql
   insert into members (user_id, household_id, person, name) values
     ('<frank user id>',  '00000000-0000-4000-8000-000000000001', 'a', 'Frank'),
     ('<sarah user id>',  '00000000-0000-4000-8000-000000000001', 'b', 'Sarah'),
     ('<tablet user id>', '00000000-0000-4000-8000-000000000001', null, 'Tablet');

   insert into household_pins (household_id, pin_hash)
   values ('00000000-0000-4000-8000-000000000001', extensions.crypt('1234', extensions.gen_salt('bf')))
   on conflict (household_id) do update set pin_hash = excluded.pin_hash;
   ```

   Run the second statement again with a new PIN to change it.

   Without the seed, create the household first: `insert into households (id, name) values ('00000000-0000-4000-8000-000000000001', 'Our place');`. Then draw the apartment in **Plan**, where the first save creates the plan row.
5. In Authentication → Sign In / Providers, turn off **Allow new users to sign up**. Nook has no sign-up screen, and the publishable key ships in the app, so leaving sign-ups on lets anyone make an account. Row-level security keeps non-members out of your data either way.
6. `npm run dev`, then sign in as the tablet on the tablet, and as yourselves on your phones.

## On the tablet

- `npm run build` and host `dist/` anywhere static (Netlify, Vercel, Cloudflare Pages), or run `npm run dev` on your machine and open the network URL Vite prints.
- In Chrome on the tablet, choose **Add to Home screen**. The manifest opens Nook fullscreen in landscape. Use Android's screen pinning to keep it there.
- The screen stays awake while Nook is open (Screen Wake Lock), and the theme switches to dark at 20:30 and back at 07:00. The `auto` button in the rail forces light or dark.
- Shared task categories are open to anyone at the tablet. The two private lists open with the household PIN, and lock again after 60 seconds without a touch and when the screen sleeps. The PIN is never stored on the device.
- After 5 wrong PINs in a row the household waits 2 minutes before the next try, then 4, 8 and so on, up to a day. A right PIN resets the count.

## On your phones

On phone-sized screens (narrower than 720px, or shorter than 500px when turned sideways), Nook drops the floorplan and the Plan editor, moves the navigation to a bottom tab bar and puts everything in one scrolling column. Home lists what's due without the map. Your own private list sits on the Tasks screen, with no PIN. You can't see the other person's. The screen is allowed to sleep as usual.

## Where things are

| Path | What |
|---|---|
| `src/nook/` | The Nook design system: React components, heat logic, `tokens.css`, `nook.css`. Copied from the design system. Change it there, then copy it back. |
| `src/data/api.ts` | The backend interface every screen talks to |
| `src/data/supabaseApi.ts` · `demoApi.ts` | Supabase implementation, and the localStorage demo |
| `src/data/store.tsx` | App state: loading, live refresh, optimistic updates, toasts with Undo |
| `src/screens/` | Home (map + what's due), Chores, Tasks (shared + private), Shopping, PlanEditor, ChoreSheet, Login |
| `src/lib/where.ts` | Room/item names, schedule wording, due dates |
| `supabase/migrations/` | Schema, row-level security, RPCs (`complete_chore`, `snooze_chore`, `log_use`, `check_tasks_pin`, `private_tasks`, `save_private_task`, `set_pin`) |

## How it fits together

- **Heat is computed in the browser.** `applyHeat(plan, chores)` paints the floorplan from chore rows, and `useNow()` re-renders every minute, so colours change on their own without any server jobs.
- **Live sync.** The Supabase API subscribes to realtime changes, so a chore ticked on a phone cools the tablet's map within a second. Nook also re-reads everything when the screen wakes, when the network comes back, and after the realtime connection rejoins.
- **No attribution.** `chore_log` records what happened and when, never who. Chores have no assignees.
- **Private lists.** Phones read their owner's private tasks directly through row-level security. The tablet's own session can't. It unlocks with `check_tasks_pin(pin)`, then calls `private_tasks(person, pin)` and `save_private_task(…)`, which check the household's one shared PIN against a bcrypt hash in `household_pins`. Wrong guesses are counted in `pin_attempts`.
- **Floorplan edits** stay local, with undo, until **Save**. Removing a room or item also deletes the chores that live on it, and the editor tells you before you save.
