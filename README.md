# UNFINISHED ∞

**Live: [olaniyan-samuel-akorede.vercel.app](https://olaniyan-samuel-akorede.vercel.app)** · a painting that no one will ever finish.

The machine starts the piece — 386 strokes it laid down over four days, flowing, searching, going nowhere in particular. It has no idea what it is making. Every visitor adds permanent ink on top of it, and everyone else in the room sees the marks arrive, live.

Open the site, drag anywhere, and press **R** to watch the whole painting replay itself from the very first stroke.

---

## What's actually happening

| | |
|---|---|
| **Canvas** | A hand-written 2D engine (`lib/engine.ts`). Committed ink is baked into an offscreen buffer, so 1,800+ strokes never cost a per-frame redraw. Incoming strokes animate in on a second layer; width tapers with pointer speed for a calligraphic line. |
| **Archive** | Postgres (Supabase). One table, `canvas_strokes`, stores every mark as normalised points `[x, y, width]` plus ink colour and opacity — resolution independent, replayable forever. |
| **Live** | Supabase Realtime streams `INSERT`s to every open screen, and a presence channel shows how many hands are in the room. |
| **Replay** | The signature move: the engine walks the archive in `created_at` order and redraws every stroke, with a scrubbable timeline that marks the exact point where the first human touched the machine's work. |
| **The machine** | `scripts/composition.mjs` — a deterministic curl-field generator: a spine, hairlines that drift along it, cool undertows, warm accents, and dust. The same seed always paints the same beginning. |

RLS is on. Anyone may read the canvas and insert their own stroke; nobody may write as the machine, update, or delete.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Supabase Postgres + Realtime · Vercel

No UI framework, no animation library, no charting library — the drawing, easing and timeline are all hand-rolled.

## Run it

```bash
npm install
cp .env.local.example .env.local   # or set the three variables below
npm run dev
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable / anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — server only>
```

### Schema

```sql
create table public.canvas_strokes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id uuid,
  source text not null default 'human' check (source in ('human','machine')),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  alpha real not null default 1 check (alpha > 0 and alpha <= 1),
  width real not null check (width > 0 and width <= 60),
  points jsonb not null check (jsonb_array_length(points) between 2 and 600)
);
```

### Let the machine paint

The piece is self-healing. When a visitor finds an empty archive, the client generates the composition and hands it to `public.paint_the_opening(spec jsonb)` — a `SECURITY DEFINER` function that paints only into an empty archive and is the sole way `source = 'machine'` rows can ever be written (anon cannot insert them directly; RLS refuses it). `GET /api/ignite` does the same from the server when a service role key is present.

To paint locally instead:

```bash
npm run seed          # 386 strokes, spread across four days
node scripts/preview.mjs out.png 1200 630   # render the composition without a browser
```

## Deploying

The site is deployed to Vercel from this repository by `supabase/functions/ship-canvas`, a small
Supabase Edge Function that reads the token from a Supabase secret and calls Vercel's deployment
API (uploading the files, with `projectSettings` so the first deployment is accepted).

```bash
# redeploy the current branch
curl "https://eporewwvgpfuzwmhpodv.supabase.co/functions/v1/ship-canvas?\
key=$DEPLOY_KEY&action=deploy&sha=$(git rev-parse HEAD)"

# check on it
curl ".../ship-canvas?key=$DEPLOY_KEY&action=list"
```

It is gated by `VERCEL_DEPLOY_KEY` and can only build this repository into this project.
`action=open` clears deployment protection; `action=verify` fetches the page, CSS, JS chunk and
the generated social card to prove the deployment is really serving.

## Keys

`1`–`7` ink · `[` `]` weight · `R` replay · `M` sound · `Esc` close
