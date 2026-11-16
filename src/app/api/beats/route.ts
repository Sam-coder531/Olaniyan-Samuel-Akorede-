import { NextRequest, NextResponse } from "next/server";
import { SLEEVE_COLORS, sanitizeBeatPattern } from "@/lib/codec";
import { listCommunityBeats, publishCommunityBeat } from "@/lib/crate-store";
import { GENRES } from "@/lib/music";
import { GenreTag, SleeveColor } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawSort = searchParams.get("sort");
  const rawGenre = searchParams.get("genre");

  const sort = rawSort === "latest" ? "latest" : "trending";
  const genre: GenreTag | "All" =
    rawGenre && GENRES.includes(rawGenre as GenreTag)
      ? (rawGenre as GenreTag)
      : "All";

  const result = await listCommunityBeats({ sort, genre });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pattern = sanitizeBeatPattern(body.pattern);
    if (!pattern) {
      return NextResponse.json(
        { error: "Add at least two active steps before pressing to the crate." },
        { status: 400 }
      );
    }

    const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
    const rawProducer =
      typeof body.producer === "string" ? body.producer.trim() : "";
    const rawCity = typeof body.city === "string" ? body.city.trim() : "";
    const rawGenre = typeof body.genre === "string" ? body.genre.trim() : "";
    const rawColor =
      typeof body.sleeveColor === "string" ? body.sleeveColor.trim() : "";

    const title = (rawTitle || pattern.title || "Untitled Tape").slice(0, 48);
    const producer = (rawProducer || "Anonymous Producer").slice(0, 36);
    const city = (rawCity || "Lagos, NG").slice(0, 36);

    if (GENRES.includes(rawGenre as GenreTag)) {
      pattern.genre = rawGenre as GenreTag;
    }

    const sleeveColor: SleeveColor = SLEEVE_COLORS.includes(
      rawColor as SleeveColor
    )
      ? (rawColor as SleeveColor)
      : "vermilion";

    const result = await publishCommunityBeat({
      title,
      producer,
      city,
      sleeveColor,
      pattern,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid beat payload." },
      { status: 400 }
    );
  }
}
