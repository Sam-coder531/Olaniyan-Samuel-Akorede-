# UNFINISHED ∞

**A painting that no one will ever finish.**

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

`GET /api/ignite` seeds the opening if the archive holds no machine strokes — the client calls it automatically when it finds an empty canvas, so the piece is self-healing. To paint locally instead:

```bash
npm run seed          # 386 strokes, spread across four days
node scripts/preview.mjs out.png 1200 630   # render the composition without a browser
```

## Keys

`1`–`7` ink · `[` `]` weight · `R` replay · `M` sound · `Esc` close
