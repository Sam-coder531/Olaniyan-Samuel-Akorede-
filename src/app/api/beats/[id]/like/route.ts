import { NextResponse } from "next/server";
import { incrementBeatCounter } from "@/lib/crate-store";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Invalid beat ID" }, { status: 400 });
  }
  const result = await incrementBeatCounter(id, "likes");
  if (result.value === null) {
    return NextResponse.json({ error: "Beat not found" }, { status: 404 });
  }
  return NextResponse.json({ likes: result.value, storage: result.storage });
}
