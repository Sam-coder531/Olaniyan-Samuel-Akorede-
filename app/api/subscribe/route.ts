import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let email = "";

  try {
    const body = (await req.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json(
      { ok: false, error: "That email doesn't look right." },
      { status: 422 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No database wired up yet — don't fail the user, just log it.
  if (!url || !key) {
    console.warn("[subscribe] supabase env missing, dropping", email);
    return NextResponse.json({ ok: true, stored: false });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from("airpods_reservations")
    .upsert(
      { email, source: "airpods-film", created_at: new Date().toISOString() },
      { onConflict: "email", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[subscribe]", error.message);
    // Table may not exist yet; treat duplicates / missing table as success-ish
    if (/duplicate|conflict/i.test(error.message)) {
      return NextResponse.json({ ok: true, stored: true });
    }
    return NextResponse.json(
      { ok: false, error: "Couldn't save that. Try again?" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, stored: true });
}
