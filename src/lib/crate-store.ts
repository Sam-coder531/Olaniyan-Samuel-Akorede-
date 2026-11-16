import { getPolySignature } from "./music";
import { SEED_COMMUNITY_BEATS } from "./presets";
import { BeatPattern, CommunityBeat, GenreTag, SleeveColor } from "./types";

const TABLE = "akorede_fm_beats";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Local session store used automatically when Supabase env vars aren't configured
const globalStore = globalThis as unknown as {
  __akoredeMemoryBeats?: CommunityBeat[];
};

function getMemoryBeats(): CommunityBeat[] {
  if (!globalStore.__akoredeMemoryBeats) {
    globalStore.__akoredeMemoryBeats = SEED_COMMUNITY_BEATS.map((b) => ({
      ...b,
    }));
  }
  return globalStore.__akoredeMemoryBeats;
}

function getSupabaseConfig(): { url: string; key: string } | null {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return { url, key };
}

function supabaseHeaders(key: string, extra?: Record<string, string>) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function listCommunityBeats(options: {
  sort?: "trending" | "latest";
  genre?: GenreTag | "All";
}): Promise<{ beats: CommunityBeat[]; storage: "supabase" | "memory" }> {
  const sort = options.sort === "latest" ? "latest" : "trending";
  const genre = options.genre && options.genre !== "All" ? options.genre : null;
  const cfg = getSupabaseConfig();

  if (cfg) {
    try {
      const params = new URLSearchParams();
      params.set("select", "*");
      params.set("limit", "24");
      params.set(
        "order",
        sort === "latest"
          ? "created_at.desc"
          : "likes.desc,plays.desc,created_at.desc"
      );
      if (genre) {
        params.set("genre", `eq.${genre}`);
      }

      const res = await fetch(`${cfg.url}/rest/v1/${TABLE}?${params.toString()}`, {
        method: "GET",
        headers: supabaseHeaders(cfg.key),
        cache: "no-store",
        signal: AbortSignal.timeout(5500),
      });

      if (res.ok) {
        const rows = (await res.json()) as CommunityBeat[];
        return { beats: rows, storage: "supabase" };
      }
    } catch {
      // Graceful fallback to memory crate if network is unreachable
    }
  }

  let items = [...getMemoryBeats()];
  if (genre) {
    items = items.filter((b) => b.genre === genre);
  }
  items.sort((a, b) =>
    sort === "latest"
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : b.likes - a.likes || b.plays - a.plays
  );
  return { beats: items.slice(0, 24), storage: "memory" };
}

export async function publishCommunityBeat(input: {
  title: string;
  producer: string;
  city: string;
  sleeveColor: SleeveColor;
  pattern: BeatPattern;
}): Promise<{ beat: CommunityBeat; storage: "supabase" | "memory" }> {
  const polySig = getPolySignature(input.pattern.tracks);
  const payload = {
    title: input.title,
    producer: input.producer,
    city: input.city,
    genre: input.pattern.genre,
    sleeve_color: input.sleeveColor,
    bpm: input.pattern.master.bpm,
    scale: input.pattern.master.scale,
    poly_signature: polySig,
    pattern: { ...input.pattern, title: input.title },
    likes: 1,
    plays: 1,
  };

  const cfg = getSupabaseConfig();
  if (cfg) {
    try {
      const res = await fetch(`${cfg.url}/rest/v1/${TABLE}`, {
        method: "POST",
        headers: supabaseHeaders(cfg.key, { Prefer: "return=representation" }),
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(5500),
      });
      if (res.ok) {
        const rows = (await res.json()) as CommunityBeat[];
        if (rows[0]) {
          return { beat: rows[0], storage: "supabase" };
        }
      }
    } catch {
      // Fallback to local memory store
    }
  }

  const created: CommunityBeat = {
    id: `local-${crypto.randomUUID()}`,
    ...payload,
    created_at: new Date().toISOString(),
  };
  getMemoryBeats().unshift(created);
  return { beat: created, storage: "memory" };
}

export async function incrementBeatCounter(
  id: string,
  field: "likes" | "plays"
): Promise<{ value: number | null; storage: "supabase" | "memory" }> {
  const cfg = getSupabaseConfig();

  if (cfg && UUID_RE.test(id)) {
    const fn =
      field === "likes"
        ? "akorede_fm_increment_likes"
        : "akorede_fm_increment_plays";
    try {
      const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: supabaseHeaders(cfg.key),
        body: JSON.stringify({ target_id: id }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const count = (await res.json()) as number | null;
        return {
          value: typeof count === "number" ? count : null,
          storage: "supabase",
        };
      }
    } catch {
      // Fallback below
    }
  }

  const mem = getMemoryBeats().find((b) => b.id === id);
  if (!mem) {
    return { value: null, storage: "memory" };
  }
  mem[field] += 1;
  return { value: mem[field], storage: "memory" };
}
