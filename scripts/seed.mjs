/**
 * Paints the machine's opening into Supabase.
 *
 *   node scripts/seed.mjs [count]
 *
 * Uses the service role key from .env.local (bypasses RLS so that rows can be
 * marked source = 'machine'). Human marks are never touched.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generateMachineStrokes } from "../lib/composition.mjs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const count = Number(process.argv[2] || 386);
const db = createClient(url, key, { auth: { persistSession: false } });

const strokes = generateMachineStrokes(count);

// spread the work across the last four days, in ascending order
const now = Date.now();
const windowMs = 4 * 24 * 60 * 60 * 1000;
const rows = strokes.map((s, i) => {
  const base = now - windowMs + (i / strokes.length) * (windowMs * 0.92);
  const jitter = (Math.random() - 0.35) * 26 * 60 * 1000;
  return {
    created_at: new Date(base + jitter).toISOString(),
    session_id: null,
    source: "machine",
    color: s.color,
    alpha: s.alpha,
    width: s.width,
    points: s.points,
  };
});

console.log(`clearing previous machine strokes…`);
const { error: delError } = await db.from("canvas_strokes").delete().eq("source", "machine");
if (delError) {
  console.error("delete failed:", delError.message);
  process.exit(1);
}

let inserted = 0;
for (let i = 0; i < rows.length; i += 80) {
  const batch = rows.slice(i, i + 80);
  const { error } = await db.from("canvas_strokes").insert(batch);
  if (error) {
    console.error(`insert failed at ${i}:`, error.message);
    process.exit(1);
  }
  inserted += batch.length;
  process.stdout.write(`\r  painted ${inserted}/${rows.length}`);
}
process.stdout.write("\n");

const { count: total } = await db
  .from("canvas_strokes")
  .select("id", { count: "exact", head: true });

console.log(`done — ${total} strokes now sit in the archive`);
