import { GENRES, INSTRUMENTS, POLY_LENGTHS, SCALE_LIST } from "./music";
import {
  BeatPattern,
  GenreTag,
  PolyLength,
  ScaleId,
  SleeveColor,
  StepVelocity,
  TrackPattern,
} from "./types";

export const SLEEVE_COLORS: SleeveColor[] = [
  "vermilion",
  "palm",
  "ochre",
  "indigo",
  "obsidian",
  "terracotta",
];

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Compact URL-safe pattern serializer so any beat can be shared as `?b=...`
 * and opens playing the exact same rhythm, pitches, polyrhythms, and FX.
 */
export function encodePatternToParam(pattern: BeatPattern): string {
  const compact = {
    v: 1,
    n: pattern.title.slice(0, 48),
    g: GENRES.indexOf(pattern.genre),
    m: [
      Math.round(pattern.master.bpm),
      Math.round(pattern.master.swing),
      Math.round(pattern.master.filter * 100),
      Math.round(pattern.master.space * 100),
      Math.round(pattern.master.drive * 100),
      Math.round(pattern.master.volume * 100),
      SCALE_LIST.findIndex((s) => s.id === pattern.master.scale),
    ],
    t: pattern.tracks.map((tr) => [
      tr.steps.join(""),
      tr.notes.map((x) => clamp(Math.round(x), 0, 7)).join(""),
      tr.length,
      Math.round(tr.volume * 100),
      tr.muted ? 1 : 0,
    ]),
  };

  const json = JSON.stringify(compact);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePatternFromParam(param: string): BeatPattern | null {
  try {
    if (!param || param.length > 2400) return null;
    const base64 = param.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (!raw || raw.v !== 1 || !Array.isArray(raw.m) || !Array.isArray(raw.t)) {
      return null;
    }

    const genre: GenreTag = GENRES[raw.g] ?? "Afrobeats";
    const scale: ScaleId = SCALE_LIST[raw.m[6]]?.id ?? "f_minor";

    const tracks: TrackPattern[] = INSTRUMENTS.map((inst, idx) => {
      const item = raw.t[idx];
      if (!Array.isArray(item)) {
        return {
          id: inst.id,
          steps: new Array<StepVelocity>(16).fill(0),
          notes: new Array<number>(16).fill(0),
          length: 16,
          volume: inst.defaultVolume,
          muted: false,
          solo: false,
        };
      }
      const stepStr = String(item[0] ?? "");
      const noteStr = String(item[1] ?? "");
      const steps: StepVelocity[] = Array.from({ length: 16 }, (_, i) => {
        const v = Number(stepStr[i] ?? 0);
        return v === 2 ? 2 : v === 1 ? 1 : 0;
      });
      const notes: number[] = Array.from({ length: 16 }, (_, i) =>
        clamp(Number(noteStr[i] ?? 0), 0, 7)
      );
      const rawLen = Number(item[2]);
      const length: PolyLength = POLY_LENGTHS.includes(rawLen as PolyLength)
        ? (rawLen as PolyLength)
        : 16;

      return {
        id: inst.id,
        steps,
        notes,
        length,
        volume: clamp(Number(item[3] ?? 75) / 100, 0, 1),
        muted: Boolean(item[4]),
        solo: false,
      };
    });

    return {
      title:
        typeof raw.n === "string" && raw.n.trim()
          ? raw.n.trim().slice(0, 48)
          : "Shared Groove",
      genre,
      master: {
        bpm: clamp(Number(raw.m[0] ?? 106), 70, 150),
        swing: clamp(Number(raw.m[1] ?? 22), 0, 65),
        filter: clamp(Number(raw.m[2] ?? 92) / 100, 0.05, 1),
        space: clamp(Number(raw.m[3] ?? 36) / 100, 0, 1),
        drive: clamp(Number(raw.m[4] ?? 18) / 100, 0, 1),
        volume: clamp(Number(raw.m[5] ?? 85) / 100, 0, 1),
        scale,
      },
      tracks,
    };
  } catch {
    return null;
  }
}

/**
 * Sanitizes and validates a BeatPattern coming from untrusted API requests.
 */
export function sanitizeBeatPattern(input: unknown): BeatPattern | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  if (!obj.master || typeof obj.master !== "object" || !Array.isArray(obj.tracks)) {
    return null;
  }

  const master = obj.master as Record<string, unknown>;
  const scaleIds = SCALE_LIST.map((s) => s.id);
  const scale: ScaleId = scaleIds.includes(master.scale as ScaleId)
    ? (master.scale as ScaleId)
    : "f_minor";
  const genre: GenreTag = GENRES.includes(obj.genre as GenreTag)
    ? (obj.genre as GenreTag)
    : "Afrobeats";

  const tracks: TrackPattern[] = INSTRUMENTS.map((inst) => {
    const found = (obj.tracks as unknown[]).find(
      (t) => t && typeof t === "object" && (t as { id?: string }).id === inst.id
    ) as Record<string, unknown> | undefined;

    const rawSteps = Array.isArray(found?.steps) ? found.steps : [];
    const rawNotes = Array.isArray(found?.notes) ? found.notes : [];
    const rawLen = Number(found?.length ?? 16);

    const steps: StepVelocity[] = Array.from({ length: 16 }, (_, i) => {
      const v = Number(rawSteps[i] ?? 0);
      return v === 2 ? 2 : v === 1 ? 1 : 0;
    });
    const notes: number[] = Array.from({ length: 16 }, (_, i) =>
      clamp(Math.round(Number(rawNotes[i] ?? 0)), 0, 7)
    );

    return {
      id: inst.id,
      steps,
      notes,
      length: POLY_LENGTHS.includes(rawLen as PolyLength)
        ? (rawLen as PolyLength)
        : 16,
      volume: clamp(Number(found?.volume ?? inst.defaultVolume), 0, 1),
      muted: Boolean(found?.muted),
      solo: false,
    };
  });

  // Require at least 2 active hits so empty grids aren't spammed to the crate
  const totalActive = tracks.reduce(
    (sum, t) =>
      sum + (t.muted ? 0 : t.steps.slice(0, t.length).filter((s) => s > 0).length),
    0
  );
  if (totalActive < 2) return null;

  const title =
    typeof obj.title === "string" && obj.title.trim()
      ? obj.title.trim().slice(0, 48)
      : "Untitled Pressing";

  return {
    title,
    genre,
    master: {
      bpm: clamp(Math.round(Number(master.bpm ?? 106)), 70, 150),
      swing: clamp(Math.round(Number(master.swing ?? 22)), 0, 65),
      filter: clamp(Number(master.filter ?? 0.92), 0.05, 1),
      space: clamp(Number(master.space ?? 0.36), 0, 1),
      drive: clamp(Number(master.drive ?? 0.18), 0, 1),
      volume: clamp(Number(master.volume ?? 0.85), 0.1, 1),
      scale,
    },
    tracks,
  };
}
