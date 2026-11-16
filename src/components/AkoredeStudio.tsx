"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Dices,
  Disc3,
  Download,
  Link2,
  Play,
  Radio,
  Square,
  Trash2,
} from "lucide-react";
import {
  AkoredeAudioEngine,
  TriggerEvent,
  renderPatternToWavBlob,
} from "@/lib/audio-engine";
import { decodePatternFromParam, encodePatternToParam } from "@/lib/codec";
import {
  INSTRUMENTS,
  SCALE_LIST,
  clonePattern,
  createEmptyPattern,
  euclideanSteps,
  generateSurpriseGroove,
} from "@/lib/music";
import { SEED_COMMUNITY_BEATS, STUDIO_PRESETS } from "@/lib/presets";
import {
  BeatPattern,
  CommunityBeat,
  EditMode,
  GenreTag,
  InstrumentId,
  MasterParams,
  PolyLength,
  ScaleId,
  StepVelocity,
  VisualizerMode,
} from "@/lib/types";
import CommunityCrate from "./CommunityCrate";
import LivePadBank from "./LivePadBank";
import OledVisualizer from "./OledVisualizer";
import PublishModal from "./PublishModal";
import RotaryKnob from "./RotaryKnob";
import SequencerGrid from "./SequencerGrid";

const INITIAL_TRIGGERS: Record<InstrumentId, number> = {
  logdrum: 0,
  kick: 0,
  rim: 0,
  shekere: 0,
  conga: 0,
  gangan: 0,
  rhodes: 0,
  kalimba: 0,
};

function formatFilterHz(norm: number): string {
  const hz = 220 * Math.pow(19500 / 220, Math.max(0.02, Math.min(1, norm)));
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
  return `${Math.round(hz)}Hz`;
}

export default function AkoredeStudio() {
  const [pattern, setPattern] = useState<BeatPattern>(() =>
    clonePattern(STUDIO_PRESETS[0].pattern)
  );
  const [activePresetId, setActivePresetId] = useState<string | null>(
    STUDIO_PRESETS[0].id
  );
  const [activeCrateBeatId, setActiveCrateBeatId] = useState<string | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [globalTick, setGlobalTick] = useState(0);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>("orbit");
  const [editMode, setEditMode] = useState<EditMode>("step");
  const [selectedTrack, setSelectedTrack] = useState<InstrumentId>("logdrum");
  const [activePads, setActivePads] = useState<
    Partial<Record<InstrumentId, boolean>>
  >({});

  // Export, share & modal state
  const [exporting, setExporting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Community Crate state
  const [crateBeats, setCrateBeats] =
    useState<CommunityBeat[]>(SEED_COMMUNITY_BEATS);
  const [crateLoading, setCrateLoading] = useState(true);
  const [crateStorage, setCrateStorage] = useState<"supabase" | "memory">(
    "memory"
  );
  const [crateSort, setCrateSort] = useState<"trending" | "latest">("trending");
  const [crateGenre, setCrateGenre] = useState<GenreTag | "All">("All");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const engineRef = useRef<AkoredeAudioEngine | null>(null);
  const lastTriggersRef = useRef<Record<InstrumentId, number>>({
    ...INITIAL_TRIGGERS,
  });
  const padTimersRef = useRef<Partial<Record<InstrumentId, number>>>({});
  const tapTimesRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const patternRef = useRef(pattern);
  const isPlayingRef = useRef(isPlaying);
  const isRecordingRef = useRef(isRecording);

  patternRef.current = pattern;
  isPlayingRef.current = isPlaying;
  isRecordingRef.current = isRecording;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // Initialize Web Audio engine once
  useEffect(() => {
    const engine = new AkoredeAudioEngine();
    engine.onStepChange = (tick) => {
      setGlobalTick(tick);
    };
    engine.onTrigger = (ev: TriggerEvent) => {
      lastTriggersRef.current[ev.instrument] = ev.timestamp;
      setActivePads((prev) => ({ ...prev, [ev.instrument]: true }));
      const existing = padTimersRef.current[ev.instrument];
      if (existing) window.clearTimeout(existing);
      padTimersRef.current[ev.instrument] = window.setTimeout(() => {
        setActivePads((prev) => ({ ...prev, [ev.instrument]: false }));
      }, 115);
    };
    engineRef.current = engine;

    const padTimers = padTimersRef.current;
    return () => {
      engine.dispose();
      Object.values(padTimers).forEach((t) => {
        if (t) window.clearTimeout(t);
      });
    };
  }, []);

  // Sync pattern changes live into running audio engine
  useEffect(() => {
    engineRef.current?.syncPattern(pattern);
  }, [pattern]);

  // Decode shared beat URL `?b=...` + restore liked IDs on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("b");
    if (encoded) {
      const decoded = decodePatternFromParam(encoded);
      if (decoded) {
        setPattern(decoded);
        setActivePresetId(null);
        showToast(`Loaded shared beat “${decoded.title}” — press Play!`);
      }
    }
    try {
      const saved = localStorage.getItem("akorede_fm_likes");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setLikedIds(new Set(parsed.filter((x) => typeof x === "string")));
        }
      }
    } catch {
      // Ignore storage restrictions
    }
  }, [showToast]);

  // Fetch Community Crate beats
  const fetchCrate = useCallback(
    async (sort: "trending" | "latest", genre: GenreTag | "All") => {
      setCrateLoading(true);
      try {
        const q = new URLSearchParams({ sort, genre });
        const res = await fetch(`/api/beats?${q.toString()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.beats)) {
            setCrateBeats(data.beats);
          }
          if (data.storage === "supabase" || data.storage === "memory") {
            setCrateStorage(data.storage);
          }
        }
      } catch {
        // Retain existing beats gracefully
      } finally {
        setCrateLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchCrate(crateSort, crateGenre);
  }, [crateSort, crateGenre, fetchCrate]);

  const togglePlayback = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlayingRef.current) {
      engine.stop();
      setIsPlaying(false);
      setGlobalTick(0);
    } else {
      engine.start(patternRef.current);
      setIsPlaying(true);
    }
  }, []);

  const handleSurprise = useCallback(() => {
    const fresh = generateSurpriseGroove();
    setPattern(fresh);
    setActivePresetId(null);
    setActiveCrateBeatId(null);
    if (!isPlayingRef.current && engineRef.current) {
      engineRef.current.start(fresh);
      setIsPlaying(true);
    }
    showToast(`Generated “${fresh.title}” (${fresh.genre} · ${fresh.master.bpm} BPM)`);
  }, [showToast]);

  const handleClear = useCallback(() => {
    setPattern((prev) => {
      const blank = createEmptyPattern(prev.master.scale);
      blank.master = { ...prev.master };
      return blank;
    });
    setActivePresetId(null);
    setActiveCrateBeatId(null);
    showToast("Cleared pattern matrix");
  }, [showToast]);

  const handleSelectPreset = useCallback((presetId: string) => {
    const found = STUDIO_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    const cloned = clonePattern(found.pattern);
    setPattern(cloned);
    setActivePresetId(found.id);
    setActiveCrateBeatId(null);
    if (!isPlayingRef.current && engineRef.current) {
      engineRef.current.start(cloned);
      setIsPlaying(true);
    }
  }, []);

  const updateMaster = useCallback(
    <K extends keyof MasterParams>(key: K, value: MasterParams[K]) => {
      setPattern((prev) => ({
        ...prev,
        master: {
          ...prev.master,
          [key]: value,
        },
      }));
    },
    []
  );

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const history = tapTimesRef.current.filter((t) => now - t < 2200);
    history.push(now);
    tapTimesRef.current = history.slice(-5);

    if (history.length >= 2) {
      let sum = 0;
      for (let i = 1; i < history.length; i++) {
        sum += history[i] - history[i - 1];
      }
      const avgMs = sum / (history.length - 1);
      const bpm = Math.max(70, Math.min(150, Math.round(60000 / avgMs)));
      updateMaster("bpm", bpm);
    }
  }, [updateMaster]);

  const handleSelectTrack = useCallback(
    (id: InstrumentId, audition = false) => {
      setSelectedTrack(id);
      if (audition && engineRef.current) {
        engineRef.current.audition(id, patternRef.current, 2);
      }
    },
    []
  );

  const handleToggleStep = useCallback(
    (trackId: InstrumentId, stepIdx: number, forceAccent: boolean) => {
      const current = patternRef.current;
      const targetTrack = current.tracks.find((t) => t.id === trackId);
      if (!targetTrack) return;

      const cur = targetTrack.steps[stepIdx] ?? 0;
      const nextVel: StepVelocity = forceAccent
        ? cur === 2
          ? 0
          : 2
        : cur > 0
          ? 0
          : 1;

      if (nextVel > 0 && !isPlayingRef.current && engineRef.current) {
        engineRef.current.audition(
          trackId,
          current,
          nextVel,
          targetTrack.notes[stepIdx]
        );
      }

      setPattern((prev) => ({
        ...prev,
        tracks: prev.tracks.map((tr) => {
          if (tr.id !== trackId) return tr;
          const steps = [...tr.steps] as StepVelocity[];
          steps[stepIdx] = nextVel;
          return { ...tr, steps };
        }),
      }));
    },
    []
  );

  const handleChangeNote = useCallback(
    (trackId: InstrumentId, stepIdx: number, nextDegree: number) => {
      engineRef.current?.audition(trackId, patternRef.current, 2, nextDegree);
      setPattern((prev) => ({
        ...prev,
        tracks: prev.tracks.map((tr) => {
          if (tr.id !== trackId) return tr;
          const notes = [...tr.notes];
          notes[stepIdx] = nextDegree;
          const steps = [...tr.steps] as StepVelocity[];
          if (steps[stepIdx] === 0) steps[stepIdx] = 1;
          return { ...tr, notes, steps };
        }),
      }));
    },
    []
  );

  const handleToggleMute = useCallback((trackId: InstrumentId) => {
    setPattern((prev) => ({
      ...prev,
      tracks: prev.tracks.map((tr) =>
        tr.id === trackId ? { ...tr, muted: !tr.muted } : tr
      ),
    }));
  }, []);

  const handleToggleSolo = useCallback((trackId: InstrumentId) => {
    setPattern((prev) => ({
      ...prev,
      tracks: prev.tracks.map((tr) =>
        tr.id === trackId ? { ...tr, solo: !tr.solo } : tr
      ),
    }));
  }, []);

  const handleCycleLength = useCallback(
    (trackId: InstrumentId, nextLength: PolyLength) => {
      setPattern((prev) => ({
        ...prev,
        tracks: prev.tracks.map((tr) =>
          tr.id === trackId ? { ...tr, length: nextLength } : tr
        ),
      }));
    },
    []
  );

  const handleEuclideanFill = useCallback((trackId: InstrumentId) => {
    setPattern((prev) => ({
      ...prev,
      tracks: prev.tracks.map((tr) => {
        if (tr.id !== trackId) return tr;
        const densityChoices =
          tr.length <= 6
            ? [2, 3, 4]
            : tr.length === 8
              ? [3, 5]
              : tr.length === 12
                ? [4, 5, 7]
                : [4, 5, 7, 9];
        const pulses =
          densityChoices[Math.floor(Math.random() * densityChoices.length)];
        const rotation = Math.floor(Math.random() * Math.min(4, tr.length));
        return {
          ...tr,
          steps: euclideanSteps(pulses, tr.length, rotation, 2),
        };
      }),
    }));
  }, []);

  const handleChangeTrackVolume = useCallback(
    (trackId: InstrumentId, volume: number) => {
      setPattern((prev) => ({
        ...prev,
        tracks: prev.tracks.map((tr) =>
          tr.id === trackId ? { ...tr, volume } : tr
        ),
      }));
    },
    []
  );

  const handleHitPad = useCallback(
    (instrument: InstrumentId, accent: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      const vel: StepVelocity = accent ? 2 : 1;
      const step = engine.audition(instrument, patternRef.current, vel);
      setSelectedTrack(instrument);

      // Quantize live hit into loop when REC overdub is active during playback
      if (isRecordingRef.current && isPlayingRef.current) {
        setPattern((prev) => ({
          ...prev,
          tracks: prev.tracks.map((tr) => {
            if (tr.id !== instrument) return tr;
            const steps = [...tr.steps] as StepVelocity[];
            const target = step % tr.length;
            steps[target] = accent ? 2 : Math.max(1, steps[target]) as StepVelocity;
            return { ...tr, steps, muted: false };
          }),
        }));
      }
    },
    []
  );

  // Global hardware keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlayback();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleSurprise();
        return;
      }
      const digit = Number(e.key);
      if (digit >= 1 && digit <= 8) {
        e.preventDefault();
        const inst = INSTRUMENTS[digit - 1];
        if (inst) handleHitPad(inst.id, e.shiftKey);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlayback, handleSurprise, handleHitPad]);

  const handleShareLink = async () => {
    const encoded = encodePatternToParam(pattern);
    const url = new URL(window.location.href);
    url.searchParams.set("b", encoded);
    window.history.replaceState({}, "", url.toString());

    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      showToast("Beat permalink copied — anyone can open and play it!");
      window.setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      showToast("URL updated in address bar — copy to share!");
    }
  };

  const handleExportWav = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await renderPatternToWavBlob(pattern, 4);
      const slug =
        pattern.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "akorede-groove";
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `${slug}-${pattern.master.bpm}bpm.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(dlUrl), 4000);
      showToast(`Exported 4-bar studio WAV (${pattern.master.bpm} BPM)`);
    } catch {
      showToast("Could not render WAV audio in this browser.");
    } finally {
      setExporting(false);
    }
  };

  const handleLoadCrateBeat = (beat: CommunityBeat) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (activeCrateBeatId === beat.id && isPlaying) {
      engine.stop();
      setIsPlaying(false);
      return;
    }

    const cloned = clonePattern(beat.pattern);
    cloned.title = beat.title;
    setPattern(cloned);
    setActivePresetId(null);
    setActiveCrateBeatId(beat.id);
    engine.stop();
    engine.start(cloned);
    setIsPlaying(true);

    // Scroll console smoothly into view if user was far down
    if (window.scrollY > 420) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Optimistic + server play increment
    setCrateBeats((prev) =>
      prev.map((b) => (b.id === beat.id ? { ...b, plays: b.plays + 1 } : b))
    );
    void fetch(`/api/beats/${encodeURIComponent(beat.id)}/play`, {
      method: "POST",
    }).catch(() => {});
  };

  const handleLikeCrateBeat = async (beat: CommunityBeat) => {
    if (likedIds.has(beat.id)) return;
    const nextLiked = new Set(likedIds);
    nextLiked.add(beat.id);
    setLikedIds(nextLiked);
    try {
      localStorage.setItem(
        "akorede_fm_likes",
        JSON.stringify(Array.from(nextLiked))
      );
    } catch {
      // Ignore
    }

    setCrateBeats((prev) =>
      prev.map((b) => (b.id === beat.id ? { ...b, likes: b.likes + 1 } : b))
    );

    try {
      const res = await fetch(`/api/beats/${encodeURIComponent(beat.id)}/like`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes === "number") {
          setCrateBeats((prev) =>
            prev.map((b) =>
              b.id === beat.id ? { ...b, likes: data.likes } : b
            )
          );
        }
      }
    } catch {
      // Keep optimistic count
    }
  };

  const handlePublished = (
    beat: CommunityBeat,
    storage: "supabase" | "memory"
  ) => {
    setCrateStorage(storage);
    setCrateGenre("All");
    setCrateBeats((prev) => [beat, ...prev.filter((b) => b.id !== beat.id)]);
    setActiveCrateBeatId(beat.id);
    setPattern((prev) => ({ ...prev, title: beat.title, genre: beat.genre }));
    showToast(
      storage === "supabase"
        ? `Pressed “${beat.title}” live to the global Supabase crate!`
        : `Pressed “${beat.title}” to the studio crate!`
    );
  };

  const getAnalyser = useCallback(
    () => engineRef.current?.getAnalyser() ?? null,
    []
  );

  const activePreset = STUDIO_PRESETS.find((p) => p.id === activePresetId);

  return (
    <div className="mx-auto max-w-[1180px] px-3.5 py-5 sm:px-6 sm:py-7">
      {/* Compact top studio bar */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181715] text-[#FF4F1F] shadow-sm">
            <Radio className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-[#181715] sm:text-lg">
                AKOREDE FM
              </h1>
              <span className="font-mono-tech rounded bg-[#181715] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wider text-[#F7F4ED]">
                MODEL AK-01
              </span>
            </div>
            <p className="font-mono-tech text-[10.5px] text-[#666055]">
              Lagos Polyrhythm &amp; Afrobeats Groovebox · by Olaniyan Samuel
              Akorede
            </p>
          </div>
        </div>

        {/* Utility bar — restrained secondary controls + single accent action */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShareLink}
            className="hw-key flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#181715]"
          >
            {copiedLink ? (
              <Check className="h-3.5 w-3.5 text-[#15803D]" />
            ) : (
              <Link2 className="h-3.5 w-3.5 text-[#59544B]" />
            )}
            {copiedLink ? "Copied" : "Share Beat"}
          </button>

          <button
            type="button"
            onClick={handleExportWav}
            disabled={exporting}
            className="hw-key flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#181715] disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5 text-[#59544B]" />
            {exporting ? "Bouncing…" : "Export WAV"}
          </button>

          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="hw-key-dark flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold"
          >
            <Disc3 className="h-3.5 w-3.5 text-[#FF5F33]" />
            Press to Crate
          </button>
        </div>
      </header>

      {/* MAIN ANODIZED HARDWARE CONSOLE */}
      <main className="hardware-chassis relative rounded-[22px] p-3.5 sm:p-5">
        {/* Subtle machined corner bolts */}
        <span className="pointer-events-none absolute top-2.5 left-2.5 h-2 w-2 rounded-full border border-[#BFB8A7] bg-[#E5DFD2]" />
        <span className="pointer-events-none absolute top-2.5 right-2.5 h-2 w-2 rounded-full border border-[#BFB8A7] bg-[#E5DFD2]" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-2 w-2 rounded-full border border-[#BFB8A7] bg-[#E5DFD2]" />
        <span className="pointer-events-none absolute right-2.5 bottom-2.5 h-2 w-2 rounded-full border border-[#BFB8A7] bg-[#E5DFD2]" />

        {/* Upper Control Deck: Transport & Presets | OLED Scope | Master Analog Knobs */}
        <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          {/* Bay 1: Transport & Preset Tape Slots */}
          <div className="hardware-bay flex flex-col justify-between rounded-xl p-3.5 lg:col-span-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono-tech text-[10px] font-semibold tracking-[0.14em] text-[#59544B] uppercase">
                  Transport &amp; Tape Bank
                </span>
                <span className="font-mono-tech text-[9.5px] text-[#867F73]">
                  [SPACE]
                </span>
              </div>

              {/* Primary transport keys */}
              <div className="grid grid-cols-12 gap-1.5">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="hw-key-orange col-span-5 flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-bold tracking-wide uppercase"
                >
                  {isPlaying ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Play
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsRecording((r) => !r)}
                  aria-pressed={isRecording}
                  title="Arm live pad overdub recording"
                  className={`col-span-2 flex h-10 cursor-pointer items-center justify-center gap-1 rounded-lg text-[11px] font-bold ${
                    isRecording
                      ? "bg-[#181715] text-[#FF5F33] ring-1 ring-[#FF4F1F]"
                      : "hw-key text-[#4A463E]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isRecording
                        ? "animate-pulse bg-[#FF4F1F]"
                        : "bg-[#C2410C]"
                    }`}
                  />
                  REC
                </button>

                <button
                  type="button"
                  onClick={handleSurprise}
                  title="Generate a fresh procedural Afrobeats / Amapiano / Afrobeat groove (Key R)"
                  className="hw-key col-span-3 flex h-10 cursor-pointer items-center justify-center gap-1 rounded-lg text-[11px] font-semibold text-[#181715]"
                >
                  <Dices className="h-3.5 w-3.5 text-[#FF4F1F]" />
                  Surprise
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  title="Clear all steps"
                  aria-label="Clear all steps"
                  className="hw-key col-span-2 flex h-10 cursor-pointer items-center justify-center rounded-lg text-[#59544B] hover:text-[#181715]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 6 Curated Studio Presets */}
            <div className="mt-3">
              <div className="grid grid-cols-3 gap-1.5">
                {STUDIO_PRESETS.map((preset) => {
                  const active = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`cursor-pointer rounded-lg px-2 py-1.5 text-left transition-all ${
                        active
                          ? "bg-[#181715] text-[#F7F4ED] shadow-xs"
                          : "hw-key text-[#181715]"
                      }`}
                    >
                      <div className="font-mono-tech flex items-center justify-between text-[9px]">
                        <span
                          className={
                            active ? "text-[#FF6940]" : "text-[#867F73]"
                          }
                        >
                          {preset.slot}
                        </span>
                        <span
                          className={
                            active ? "text-[#A7A299]" : "text-[#867F73]"
                          }
                        >
                          {preset.pattern.master.bpm}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10.5px] font-semibold leading-tight">
                        {preset.pattern.title}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="font-mono-tech mt-2 truncate text-[9.5px] text-[#6B655B]">
                {activePreset
                  ? `${activePreset.location} · ${activePreset.pattern.genre}`
                  : `Custom Session · ${pattern.genre} · ${pattern.master.bpm} BPM`}
              </p>
            </div>
          </div>

          {/* Bay 2: Recessed Matte-Black OLED Polyrhythm & Oscilloscope Screen */}
          <div className="lg:col-span-4">
            <OledVisualizer
              pattern={pattern}
              isPlaying={isPlaying}
              globalTick={globalTick}
              mode={visualizerMode}
              onModeChange={setVisualizerMode}
              getAnalyser={getAnalyser}
              lastTriggersRef={lastTriggersRef}
            />
          </div>

          {/* Bay 3: Master Analog Rotary Knobs & Scale Selector */}
          <div className="hardware-bay flex flex-col justify-between rounded-xl p-3.5 lg:col-span-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono-tech text-[10px] font-semibold tracking-[0.14em] text-[#59544B] uppercase">
                Master Analog Bus
              </span>
              <button
                type="button"
                onClick={handleTapTempo}
                title="Tap repeatedly to set tempo"
                className="hw-key font-mono-tech cursor-pointer rounded px-2 py-0.5 text-[9.5px] font-bold tracking-wider text-[#181715]"
              >
                TAP BPM
              </button>
            </div>

            <div className="grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-6 lg:grid-cols-3">
              <RotaryKnob
                label="Tempo"
                value={pattern.master.bpm}
                min={70}
                max={150}
                step={1}
                defaultValue={104}
                displayValue={`${pattern.master.bpm}`}
                accentColor="#FF4F1F"
                onChange={(v) => updateMaster("bpm", Math.round(v))}
              />
              <RotaryKnob
                label="Swing"
                value={pattern.master.swing}
                min={0}
                max={65}
                step={1}
                defaultValue={24}
                displayValue={`${Math.round(pattern.master.swing)}%`}
                accentColor="#D97706"
                onChange={(v) => updateMaster("swing", Math.round(v))}
              />
              <RotaryKnob
                label="Filter"
                value={pattern.master.filter}
                min={0.05}
                max={1}
                step={0.01}
                defaultValue={0.92}
                displayValue={formatFilterHz(pattern.master.filter)}
                accentColor="#15803D"
                onChange={(v) => updateMaster("filter", v)}
              />
              <RotaryKnob
                label="Space"
                value={pattern.master.space}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.38}
                displayValue={`${Math.round(pattern.master.space * 100)}%`}
                accentColor="#0F766E"
                onChange={(v) => updateMaster("space", v)}
              />
              <RotaryKnob
                label="Drive"
                value={pattern.master.drive}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.18}
                displayValue={`${Math.round(pattern.master.drive * 100)}%`}
                accentColor="#B45309"
                onChange={(v) => updateMaster("drive", v)}
              />
              <RotaryKnob
                label="Level"
                value={pattern.master.volume}
                min={0.1}
                max={1}
                step={0.01}
                defaultValue={0.85}
                displayValue={`${Math.round(pattern.master.volume * 100)}%`}
                accentColor="#181715"
                onChange={(v) => updateMaster("volume", v)}
              />
            </div>

            {/* Key / Scale Tuning Strip */}
            <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-[#D8D1C2] pt-2">
              <span className="font-mono-tech text-[9.5px] font-semibold text-[#6B655B] uppercase">
                Key
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {SCALE_LIST.map((sc) => {
                  const active = pattern.master.scale === sc.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => updateMaster("scale", sc.id as ScaleId)}
                      title={sc.label}
                      className={`font-mono-tech cursor-pointer rounded px-1.5 py-0.5 text-[9.5px] font-semibold transition-colors ${
                        active
                          ? "bg-[#181715] text-[#F7F4ED]"
                          : "bg-[#E2DCD0] text-[#59544B] hover:text-[#181715]"
                      }`}
                    >
                      {sc.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Middle Deck: 8-Track Polyrhythm Step Sequencer */}
        <SequencerGrid
          pattern={pattern}
          isPlaying={isPlaying}
          globalTick={globalTick}
          selectedTrack={selectedTrack}
          editMode={editMode}
          onSelectTrack={handleSelectTrack}
          onEditModeChange={setEditMode}
          onToggleStep={handleToggleStep}
          onChangeNote={handleChangeNote}
          onToggleMute={handleToggleMute}
          onToggleSolo={handleToggleSolo}
          onCycleLength={handleCycleLength}
          onEuclideanFill={handleEuclideanFill}
          onChangeVolume={handleChangeTrackVolume}
        />

        {/* Lower Deck: Playable Live Drum & Synth Pads */}
        <div className="mt-3.5">
          <LivePadBank
            activePads={activePads}
            isRecording={isRecording}
            onHitPad={handleHitPad}
          />
        </div>
      </main>

      {/* LIVE SUPABASE COMMUNITY BEAT CRATE */}
      <CommunityCrate
        beats={crateBeats}
        loading={crateLoading}
        storage={crateStorage}
        sort={crateSort}
        genreFilter={crateGenre}
        activeBeatId={activeCrateBeatId}
        isPlaying={isPlaying}
        likedIds={likedIds}
        onSortChange={setCrateSort}
        onGenreChange={setCrateGenre}
        onLoadBeat={handleLoadCrateBeat}
        onLikeBeat={handleLikeCrateBeat}
        onOpenPublish={() => setPublishOpen(true)}
      />

      {/* Minimalist studio colophon */}
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#D5CFC1] pt-5 pb-4 text-xs text-[#666055]">
        <div className="font-mono-tech flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="font-semibold text-[#181715]">
            Olaniyan Samuel Akorede
          </span>
          <span>·</span>
          <span>6.5244° N, 3.3792° E · Lagos, NG</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            Pure Web Audio DSP · Zero Samples
          </span>
        </div>

        <a
          href="https://github.com/Sam-coder531/Olaniyan-Samuel-Akorede-"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-[#181715] transition-colors hover:text-[#FF4F1F]"
        >
          Sam-coder531/Olaniyan-Samuel-Akorede-
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </footer>

      {/* Publish modal */}
      {publishOpen && (
        <PublishModal
          pattern={pattern}
          onClose={() => setPublishOpen(false)}
          onPublished={handlePublished}
        />
      )}

      {/* Subtle hardware status toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="font-mono-tech fixed right-5 bottom-5 z-50 rounded-xl border border-[#2F2D2A] bg-[#181715] px-4 py-2.5 text-xs font-medium text-[#F7F4ED] shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
