export type InstrumentId =
  | "logdrum"
  | "kick"
  | "rim"
  | "shekere"
  | "conga"
  | "gangan"
  | "rhodes"
  | "kalimba";

/** 0 = silent, 1 = normal velocity, 2 = accented velocity */
export type StepVelocity = 0 | 1 | 2;

export type PolyLength = 5 | 6 | 8 | 12 | 16;

export type ScaleId =
  | "f_minor"
  | "d_dorian"
  | "g_major"
  | "a_minor"
  | "eb_major";

export type GenreTag =
  | "Afrobeats"
  | "Amapiano"
  | "Afrobeat"
  | "Highlife"
  | "Afro-Tech";

export type VisualizerMode = "orbit" | "scope" | "spectrum";

export type EditMode = "step" | "accent" | "pitch";

export interface InstrumentMeta {
  id: InstrumentId;
  code: string;
  name: string;
  subtitle: string;
  color: string;
  keyHint: string;
  tonal: boolean;
  defaultVolume: number;
  pitchLabels?: string[];
}

export interface TrackPattern {
  id: InstrumentId;
  /** Always length 16; active loop uses indices [0 .. length - 1] */
  steps: StepVelocity[];
  /** Scale degree 0..7 per step (used by tonal instruments) */
  notes: number[];
  /** Polyrhythmic loop length */
  length: PolyLength;
  /** 0..1 track gain */
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface MasterParams {
  /** 70..150 BPM */
  bpm: number;
  /** 0..65 percent pocket shuffle */
  swing: number;
  /** 0..1 low-pass filter openness (1 = wide open 19kHz) */
  filter: number;
  /** 0..1 reverb + dotted-eighth delay send */
  space: number;
  /** 0..1 warm analog tape saturation */
  drive: number;
  /** 0..1 master output level */
  volume: number;
  scale: ScaleId;
}

export interface BeatPattern {
  title: string;
  genre: GenreTag;
  master: MasterParams;
  tracks: TrackPattern[];
}

export interface StudioPreset {
  id: string;
  slot: string;
  location: string;
  description: string;
  pattern: BeatPattern;
}

export type SleeveColor =
  | "vermilion"
  | "palm"
  | "ochre"
  | "indigo"
  | "obsidian"
  | "terracotta";

export interface CommunityBeat {
  id: string;
  title: string;
  producer: string;
  city: string;
  genre: GenreTag;
  sleeve_color: SleeveColor;
  bpm: number;
  scale: ScaleId;
  poly_signature: string;
  pattern: BeatPattern;
  likes: number;
  plays: number;
  created_at: string;
}
