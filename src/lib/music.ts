import {
  BeatPattern,
  GenreTag,
  InstrumentId,
  InstrumentMeta,
  PolyLength,
  ScaleId,
  StepVelocity,
  TrackPattern,
} from "./types";

export const POLY_LENGTHS: PolyLength[] = [16, 12, 8, 6, 5];

export const GENRES: GenreTag[] = [
  "Afrobeats",
  "Amapiano",
  "Afrobeat",
  "Highlife",
  "Afro-Tech",
];

export const INSTRUMENTS: InstrumentMeta[] = [
  {
    id: "logdrum",
    code: "CH·01",
    name: "Log Drum",
    subtitle: "Sub-Wood Bass",
    color: "#FF4F1F",
    keyHint: "1",
    tonal: true,
    defaultVolume: 0.88,
  },
  {
    id: "kick",
    code: "CH·02",
    name: "Eko Kick",
    subtitle: "Warm Analog 60Hz",
    color: "#1F1E1C",
    keyHint: "2",
    tonal: false,
    defaultVolume: 0.86,
  },
  {
    id: "rim",
    code: "CH·03",
    name: "Lagos Rim",
    subtitle: "Wood Clave Knock",
    color: "#D97706",
    keyHint: "3",
    tonal: false,
    defaultVolume: 0.78,
  },
  {
    id: "shekere",
    code: "CH·04",
    name: "Shekere",
    subtitle: "Woven Gourd Beads",
    color: "#15803D",
    keyHint: "4",
    tonal: false,
    defaultVolume: 0.64,
  },
  {
    id: "conga",
    code: "CH·05",
    name: "Conga",
    subtitle: "Open Skin Slap",
    color: "#B45309",
    keyHint: "5",
    tonal: false,
    defaultVolume: 0.72,
  },
  {
    id: "gangan",
    code: "CH·06",
    name: "Talking Drum",
    subtitle: "Gangan Pitch Bend",
    color: "#1D4ED8",
    keyHint: "6",
    tonal: true,
    defaultVolume: 0.74,
  },
  {
    id: "rhodes",
    code: "CH·07",
    name: "Rhodes MkI",
    subtitle: "Lush 9th Voicings",
    color: "#9F1239",
    keyHint: "7",
    tonal: true,
    defaultVolume: 0.66,
  },
  {
    id: "kalimba",
    code: "CH·08",
    name: "Kalimba",
    subtitle: "Thumb Tine Pluck",
    color: "#0F766E",
    keyHint: "8",
    tonal: true,
    defaultVolume: 0.68,
  },
];

export interface ScaleDefinition {
  id: ScaleId;
  label: string;
  shortLabel: string;
  /** Base MIDI note for root (bass register around F1-A1) */
  bassRootMidi: number;
  /** 8 semitone offsets from root (0..7) */
  intervals: number[];
  /** Note labels for UI pitch lane (0..7) */
  noteNames: string[];
  /** Chord labels for Rhodes lane (0..7) */
  chordNames: string[];
  /** 8 warm 4-note chord voicings as MIDI notes (mid register) */
  chordsMidi: number[][];
}

export const SCALES: Record<ScaleId, ScaleDefinition> = {
  f_minor: {
    id: "f_minor",
    label: "F Minor",
    shortLabel: "Fm9",
    bassRootMidi: 41, // F2 (87.31 Hz) -> sub drops octave cleanly
    intervals: [0, 2, 3, 5, 7, 8, 10, 12],
    noteNames: ["F", "G", "Ab", "Bb", "C", "Db", "Eb", "F'"],
    chordNames: ["Fm9", "DbM9", "AbM7", "Eb6", "Bbm9", "Cm7", "Db6/9", "Fm11"],
    chordsMidi: [
      [53, 56, 60, 63, 67], // Fm9
      [49, 53, 56, 60, 63], // Dbmaj9
      [56, 60, 63, 67], // Abmaj7
      [51, 55, 58, 60, 65], // Eb6/9
      [46, 49, 53, 56, 60], // Bbm9
      [48, 51, 55, 58], // Cm7
      [49, 53, 58, 63], // Db6/9
      [53, 56, 63, 67, 70], // Fm11
    ],
  },
  d_dorian: {
    id: "d_dorian",
    label: "D Dorian",
    shortLabel: "Dm9",
    bassRootMidi: 38, // D2
    intervals: [0, 2, 3, 5, 7, 9, 10, 12],
    noteNames: ["D", "E", "F", "G", "A", "B", "C", "D'"],
    chordNames: ["Dm9", "G13", "FM9", "Em7", "Am9", "CM9", "Gm9", "Dm11"],
    chordsMidi: [
      [50, 53, 57, 60, 64], // Dm9
      [55, 59, 62, 64, 65], // G13
      [53, 57, 60, 64, 67], // Fmaj9
      [52, 55, 59, 62], // Em7
      [57, 60, 64, 67, 71], // Am9
      [48, 52, 55, 59, 62], // Cmaj9
      [55, 58, 62, 65, 69], // Gm9
      [50, 53, 60, 64, 67], // Dm11
    ],
  },
  g_major: {
    id: "g_major",
    label: "G Highlife",
    shortLabel: "GM9",
    bassRootMidi: 43, // G2
    intervals: [0, 2, 4, 5, 7, 9, 11, 12],
    noteNames: ["G", "A", "B", "C", "D", "E", "F#", "G'"],
    chordNames: ["GM9", "CM9", "Am9", "D9sus", "Em9", "Bm7", "C6/9", "G6/9"],
    chordsMidi: [
      [55, 59, 62, 66, 69], // Gmaj9
      [48, 52, 55, 59, 62], // Cmaj9
      [57, 60, 64, 67, 71], // Am9
      [50, 55, 57, 60, 64], // D9sus4
      [52, 55, 59, 62, 66], // Em9
      [59, 62, 66, 69], // Bm7
      [48, 52, 57, 62], // C6/9
      [55, 59, 64, 69], // G6/9
    ],
  },
  a_minor: {
    id: "a_minor",
    label: "A Minor",
    shortLabel: "Am9",
    bassRootMidi: 33, // A1 (55 Hz deep sub, octave up 45 for clarity)
    intervals: [0, 2, 3, 5, 7, 8, 10, 12],
    noteNames: ["A", "B", "C", "D", "E", "F", "G", "A'"],
    chordNames: ["Am9", "FM9", "Dm9", "G6/9", "Em7", "CM9", "F6/9", "Am11"],
    chordsMidi: [
      [57, 60, 64, 67, 71], // Am9
      [53, 57, 60, 64, 67], // Fmaj9
      [50, 53, 57, 60, 64], // Dm9
      [55, 59, 64, 69], // G6/9
      [52, 55, 59, 62], // Em7
      [48, 52, 55, 59, 62], // Cmaj9
      [53, 57, 62, 67], // F6/9
      [57, 60, 67, 71, 74], // Am11
    ],
  },
  eb_major: {
    id: "eb_major",
    label: "Eb Soul",
    shortLabel: "EbM9",
    bassRootMidi: 39, // Eb2
    intervals: [0, 2, 4, 5, 7, 9, 11, 12],
    noteNames: ["Eb", "F", "G", "Ab", "Bb", "C", "D", "Eb'"],
    chordNames: ["EbM9", "AbM9", "Cm9", "Fm9", "Bb13", "Gm7", "Ab6/9", "Eb6"],
    chordsMidi: [
      [51, 55, 58, 62, 65], // Ebmaj9
      [56, 60, 63, 67, 70], // Abmaj9
      [48, 51, 55, 58, 62], // Cm9
      [53, 56, 60, 63, 67], // Fm9
      [46, 50, 53, 56, 58, 63], // Bb13
      [55, 58, 62, 65], // Gm7
      [56, 60, 65, 70], // Ab6/9
      [51, 55, 58, 60], // Eb6
    ],
  },
};

export const SCALE_LIST: ScaleDefinition[] = Object.values(SCALES);

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getDegreeFreq(
  scaleId: ScaleId,
  degree: number,
  octaveOffset = 0
): number {
  const scale = SCALES[scaleId] ?? SCALES.f_minor;
  const clamped = Math.max(0, Math.min(7, Math.round(degree)));
  const base = scaleId === "a_minor" ? 45 : scale.bassRootMidi;
  const midi = base + scale.intervals[clamped] + octaveOffset * 12;
  return midiToFreq(midi);
}

export function getChordFreqs(scaleId: ScaleId, degree: number): number[] {
  const scale = SCALES[scaleId] ?? SCALES.f_minor;
  const clamped = Math.max(0, Math.min(7, Math.round(degree)));
  return scale.chordsMidi[clamped].map(midiToFreq);
}

/**
 * Bjorklund Euclidean rhythm generator — distributes `pulses` as evenly as
 * possible across `steps`, then rotates by `rotation`. Core building block
 * of West African bell and timeline patterns (e.g. E(5,12), E(7,12), E(5,16)).
 */
export function euclideanSteps(
  pulses: number,
  length: PolyLength,
  rotation = 0,
  accentEvery = 2
): StepVelocity[] {
  const k = Math.max(0, Math.min(length, Math.round(pulses)));
  const active: number[] = new Array(length).fill(0);

  if (k > 0) {
    let bucket = 0;
    for (let i = 0; i < length; i++) {
      bucket += k;
      if (bucket >= length) {
        bucket -= length;
        active[i] = 1;
      }
    }
    // Shift so beat 0 gets a hit before applying rotation
    const firstOne = active.indexOf(1);
    if (firstOne > 0) {
      const shifted = active.slice(firstOne).concat(active.slice(0, firstOne));
      for (let i = 0; i < length; i++) active[i] = shifted[i];
    }
  }

  const out: StepVelocity[] = new Array(16).fill(0);
  let hitCount = 0;
  for (let i = 0; i < length; i++) {
    const srcIdx = (((i - rotation) % length) + length) % length;
    if (active[srcIdx]) {
      out[i] = accentEvery > 0 && hitCount % accentEvery === 0 ? 2 : 1;
      hitCount++;
    }
  }
  return out;
}

export function getPolySignature(tracks: TrackPattern[]): string {
  const activeLengths = Array.from(
    new Set(
      tracks
        .filter((t) => !t.muted && t.steps.slice(0, t.length).some((s) => s > 0))
        .map((t) => t.length)
    )
  ).sort((a, b) => b - a);

  if (activeLengths.length === 0) return "16";
  if (activeLengths.length === 1) return `${activeLengths[0]}/16`;
  return activeLengths.join(" : ");
}

export function createEmptyPattern(scale: ScaleId = "f_minor"): BeatPattern {
  return {
    title: "Blank Tape",
    genre: "Afrobeats",
    master: {
      bpm: 106,
      swing: 22,
      filter: 0.92,
      space: 0.34,
      drive: 0.18,
      volume: 0.84,
      scale,
    },
    tracks: INSTRUMENTS.map((inst) => ({
      id: inst.id,
      steps: new Array<StepVelocity>(16).fill(0),
      notes: [0, 0, 3, 2, 0, 4, 3, 2, 0, 0, 5, 4, 3, 2, 6, 4],
      length: 16,
      volume: inst.defaultVolume,
      muted: false,
      solo: false,
    })),
  };
}

export function clonePattern(pattern: BeatPattern): BeatPattern {
  return {
    title: pattern.title,
    genre: pattern.genre,
    master: { ...pattern.master },
    tracks: pattern.tracks.map((t) => ({
      ...t,
      steps: [...t.steps] as StepVelocity[],
      notes: [...t.notes],
    })),
  };
}

const SURPRISE_ADJ = [
  "Lagoon",
  "Ikoyi",
  "Yaba",
  "Midnight",
  "Golden",
  "Velvet",
  "Solar",
  "Atlantic",
  "Surulere",
  "Harmattan",
  "Neon",
  "Palmwine",
  "Eko",
  "Oshodi",
];

const SURPRISE_NOUN = [
  "Bounce",
  "Telemetry",
  "Groove",
  "Riddim",
  "Tape",
  "Mirage",
  "Session",
  "Pulse",
  "Drift",
  "Dub",
  "Cruiser",
  "Anthem",
  "Signal",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a genuinely musical, genre-aware Afrobeats / Amapiano / Afrobeat /
 * Highlife / Afro-Tech pattern with authentic syncopation and polyrhythms.
 */
export function generateSurpriseGroove(): BeatPattern {
  const genre = pick(GENRES);
  const scale = pick(SCALE_LIST).id;
  const title = `${pick(SURPRISE_ADJ)} ${pick(SURPRISE_NOUN)}`;

  const bpmRanges: Record<GenreTag, [number, number]> = {
    Afrobeats: [98, 110],
    Amapiano: [111, 115],
    Afrobeat: [116, 126],
    Highlife: [90, 102],
    "Afro-Tech": [120, 126],
  };
  const [minBpm, maxBpm] = bpmRanges[genre];
  const bpm = minBpm + Math.floor(Math.random() * (maxBpm - minBpm + 1));

  const swing =
    genre === "Amapiano"
      ? 24 + Math.floor(Math.random() * 14)
      : genre === "Afro-Tech"
        ? 10 + Math.floor(Math.random() * 12)
        : 18 + Math.floor(Math.random() * 18);

  const p = createEmptyPattern(scale);
  p.title = title;
  p.genre = genre;
  p.master.bpm = bpm;
  p.master.swing = swing;
  p.master.filter = 0.84 + Math.random() * 0.14;
  p.master.space = 0.28 + Math.random() * 0.24;
  p.master.drive = 0.14 + Math.random() * 0.2;

  const track = (id: InstrumentId) => p.tracks.find((t) => t.id === id)!;

  // 1. Kick foundation
  const kickPatterns: Record<GenreTag, StepVelocity[][]> = {
    Afrobeats: [
      [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 1, 0],
      [2, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 0, 1, 0, 0, 0],
      [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0],
    ],
    Amapiano: [
      [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0],
      [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    ],
    Afrobeat: [
      [2, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 1, 0, 0, 0],
      [2, 0, 0, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 1, 0],
    ],
    Highlife: [
      [2, 0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 0, 1, 0, 0, 0],
    ],
    "Afro-Tech": [
      [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
    ],
  };
  track("kick").steps = [...pick(kickPatterns[genre])];

  // 2. Lagos Rim / Clave
  const rimTemplates: StepVelocity[][] = [
    [0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 1, 0, 2, 0, 0, 0], // Iconic Lagos bounce
    [0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 0, 2, 0, 1, 0],
    [2, 0, 0, 1, 0, 0, 2, 0, 0, 0, 2, 0, 1, 0, 0, 0], // Son/Afro clave
    [0, 0, 0, 2, 0, 0, 1, 0, 0, 2, 0, 0, 2, 0, 0, 1],
  ];
  track("rim").steps = [...pick(rimTemplates)];

  // 3. Shekere (crisp rolling shaker with optional polyrhythm)
  if (genre === "Amapiano" || genre === "Afro-Tech") {
    track("shekere").steps = [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 1];
  } else if (genre === "Afrobeat") {
    track("shekere").length = 12;
    track("shekere").steps = euclideanSteps(7, 12, 0, 2);
  } else {
    track("shekere").steps = euclideanSteps(pick([9, 11, 12]), 16, 1, 3);
  }

  // 4. Log Drum (signature syncopated bassline)
  const logStepPool: StepVelocity[][] = [
    [2, 0, 0, 2, 0, 0, 1, 2, 0, 0, 2, 0, 1, 0, 2, 0],
    [2, 0, 0, 1, 0, 2, 0, 0, 2, 0, 0, 2, 0, 1, 2, 0],
    [0, 0, 2, 0, 0, 1, 0, 2, 0, 0, 2, 1, 0, 2, 0, 1],
    [2, 0, 0, 0, 0, 0, 2, 0, 0, 1, 0, 2, 0, 0, 1, 0],
  ];
  track("logdrum").steps = [...pick(logStepPool)];
  const bassNotes = [0, 2, 3, 4, 5, 6, 7];
  track("logdrum").notes = Array.from({ length: 16 }, (_, i) =>
    i === 0 || i === 8 ? 0 : pick(bassNotes)
  );

  // 5. Conga (polyrhythm flavor!)
  const congaLen: PolyLength = pick([16, 12, 8]);
  track("conga").length = congaLen;
  track("conga").steps = euclideanSteps(
    congaLen === 8 ? 3 : congaLen === 12 ? 5 : 5,
    congaLen,
    pick([0, 1, 2]),
    2
  );

  // 6. Talking Drum (Gangan) — expressive West African polyrhythm
  const ganganLen: PolyLength = pick([12, 16, 6]);
  track("gangan").length = ganganLen;
  track("gangan").steps = euclideanSteps(
    ganganLen === 6 ? 2 : 4,
    ganganLen,
    pick([1, 2, 3]),
    2
  );
  track("gangan").notes = Array.from({ length: 16 }, () =>
    pick([0, 2, 3, 4, 6, 7])
  );

  // 7. Rhodes warm chord stabs
  const rhodesTemplates: StepVelocity[][] = [
    [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 1, 0],
    [2, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0],
  ];
  track("rhodes").steps = [...pick(rhodesTemplates)];
  const prog = pick([
    [0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
    [0, 0, 0, 0, 0, 0, 4, 4, 1, 1, 1, 1, 3, 3, 5, 5],
    [0, 0, 0, 2, 2, 2, 1, 1, 4, 4, 4, 4, 3, 3, 6, 6],
  ]);
  track("rhodes").notes = [...prog];

  // 8. Kalimba sparkling pentatonic topline
  const kalimbaLen: PolyLength = pick([16, 12, 8]);
  track("kalimba").length = kalimbaLen;
  track("kalimba").steps = euclideanSteps(
    kalimbaLen === 8 ? 3 : 5,
    kalimbaLen,
    pick([0, 2]),
    3
  );
  const pentatonic = [0, 2, 3, 4, 6, 7];
  track("kalimba").notes = Array.from({ length: 16 }, () => pick(pentatonic));

  return p;
}
