# AirPods Pro — *Silence, engineered.*

An interactive product film: a scroll-driven, Apple-keynote-style landing page.
The page pins itself and the product unfolds as you scroll — hero → anatomy →
exploded view → noise cancellation → transparency → spatial audio → finishes →
reserve.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **motion** (Framer Motion successor) for the scroll timeline, springs and scroll-linked transforms
- **Supabase** for the reservation list (`airpods_reservations`)
- Product imagery generated for this page, served as optimised WebP (~540 KB total for 10 plates)

## How the scroll film works

`components/AirPodsFilm.tsx` defines the beats as scroll windows on a single
`useScroll` progress value. Every plate, headline and callout reads that one
value through `useTransform`, smoothed by a spring, so nothing can drift out of
sync. `components/StickyScene.tsx` holds the reusable `Plate`, `Copy` and
`Hotspot` primitives.

Adding a scene = adding one entry to the `SCENES` array plus a `Copy` block with
matching `from`/`to` numbers.

## Local

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Supabase

The reserve form posts to `/api/subscribe`, which upserts into
`airpods_reservations` using the service-role key when present (falls back to the
anon key, and no-ops gracefully if neither is configured).

```sql
create table if not exists public.airpods_reservations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'airpods-film',
  created_at timestamptz not null default now()
);
alter table public.airpods_reservations enable row level security;
-- no anon policies: writes go through the service-role key in the API route
```

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

> Concept demo. Not affiliated with Apple Inc.
