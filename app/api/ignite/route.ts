import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// @ts-ignore — plain ESM generator, shared with the seeding script so the artwork
// is identical whether it is painted from CI, a laptop, or the deployed server.
import { generateMachineStrokes } from "../../../lib/composition.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

let igniting = false;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 500 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { count: existing, error: countError } = await db
    .from("canvas_strokes")
    .select("id", { count: "exact", head: true })
    .eq("source", "machine");

  if (countError) {
    return NextResponse.json({ ok: false, reason: countError.message }, { status: 500 });
  }

  if ((existing ?? 0) > 0) {
    return NextResponse.json({ ok: true, seeded: false, machine: existing });
  }

  if (igniting) {
    return NextResponse.json({ ok: true, seeding: true }, { status: 202 });
  }
  igniting = true;

  try {
    const strokes = generateMachineStrokes(386);

    // The machine worked for four days before anyone walked in.
    const now = Date.now();
    const span = 4 * 24 * 60 * 60 * 1000;
    const rows = strokes.map((s: Record<string, unknown>, i: number) => {
      const base = now - span + (i / strokes.length) * span * 0.92;
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

    for (let i = 0; i < rows.length; i += 60) {
      const { error } = await db.from("canvas_strokes").insert(rows.slice(i, i + 60));
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, seeded: true, strokes: rows.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  } finally {
    igniting = false;
  }
}
