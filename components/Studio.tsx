"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PaintingEngine } from "@/lib/engine";
import { PALETTE, SIZES } from "@/lib/palette";
import { CONNECTED, supabase } from "@/lib/supabase";
import { toStroke, type Stroke, type StrokeRow } from "@/lib/types";

const LOAD_LIMIT = 1800;
const NOTES = [293.66, 349.23, 392.0, 440.0, 493.88, 587.33, 659.25];

type Stats = { machine: number; humans: number; begun: string | null };

type ReplayState = {
  on: boolean;
  progress: number;
  drawn: number;
  total: number;
  complete: boolean;
  machineShare: number;
};

const EMPTY_REPLAY: ReplayState = {
  on: false,
  progress: 0,
  drawn: 0,
  total: 0,
  complete: false,
  machineShare: 0,
};

const newId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

const fmt = (n: number) => n.toLocaleString("en-US");

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PaintingEngine | null>(null);
  const sessionRef = useRef<string>("");
  const pointerRef = useRef<{ id: number; active: boolean }>({ id: -1, active: false });
  const soundRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastNoteRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstStroke = useRef(true);

  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState(true);
  const [stats, setStats] = useState<Stats>({ machine: 0, humans: 0, begun: null });
  const [painters, setPainters] = useState(1);
  const [ink, setInk] = useState(0);
  const [size, setSize] = useState(1);
  const [sound, setSound] = useState(false);
  const [replay, setReplay] = useState<ReplayState>(EMPTY_REPLAY);
  const [toast, setToast] = useState<string | null>(null);
  const [whisper, setWhisper] = useState<string | null>(null);
  const [strokes, setStrokes] = useState(0);
  const [igniting, setIgniting] = useState(false);
  const [mine, setMine] = useState(0);

  const inkHex = PALETTE[ink].hex;
  const width = SIZES[size].width;

  /* ----------------------------------------------------------------- sound */

  const pluck = useCallback((freq: number, gain = 1) => {
    if (!soundRef.current) return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!audioRef.current) audioRef.current = new Ctor();
      const ac = audioRef.current;
      if (ac.state === "suspended") void ac.resume();
      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.07 * gain, t + 0.014);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(env).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 1.15);
    } catch {
      /* silence is acceptable */
    }
  }, []);

  /* ------------------------------------------------------------------ toast */

  const say = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const whisperIn = useCallback((message: string) => {
    setWhisper(message);
    if (whisperTimer.current) clearTimeout(whisperTimer.current);
    whisperTimer.current = setTimeout(() => setWhisper(null), 5200);
  }, []);

  /* ---------------------------------------------------------------- engine */

  useEffect(() => {
    sessionRef.current = window.localStorage.getItem("unfinished.session") || newId();
    window.localStorage.setItem("unfinished.session", sessionRef.current);

    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!canvas) return;

    const engine = new PaintingEngine(canvas, tip, {
      onReplay: (progress, drawn, total, complete) => {
        const rounded = Math.round(progress * 240) / 240;
        setReplay((prev) =>
          prev.on
            ? {
                ...prev,
                progress: rounded,
                drawn,
                total,
                complete,
                machineShare: prev.machineShare,
              }
            : prev,
        );
        if (soundRef.current && drawn > 0) {
          const now = performance.now();
          if (now - lastNoteRef.current > 210) {
            lastNoteRef.current = now;
            pluck(NOTES[drawn % NOTES.length], 0.45);
          }
        }
      },
    });
    engineRef.current = engine;

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, [pluck]);

  /* ------------------------------------------------------------------- data */

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    const sb = supabase;
    let alive = true;
    let channel: ReturnType<typeof sb.channel> | null = null;
    let presence: ReturnType<typeof sb.channel> | null = null;

    const load = async (allowIgnite = true) => {
      try {
      const [{ data }, machineCount, humanCount, firstMark] = await Promise.all([
        sb
          .from("canvas_strokes")
          .select("id, created_at, session_id, source, color, alpha, width, points")
          .order("created_at", { ascending: false })
          .limit(LOAD_LIMIT),
        sb.from("canvas_strokes").select("id", { count: "exact", head: true }).eq("source", "machine"),
        sb.from("canvas_strokes").select("id", { count: "exact", head: true }).eq("source", "human"),
        sb.from("canvas_strokes").select("created_at").order("created_at", { ascending: true }).limit(1),
      ]);

      if (!alive) return;

      const machines = machineCount.count ?? 0;

      // an empty room: the machine paints its opening before anybody arrives
      if (machines === 0 && allowIgnite) {
        setIgniting(true);
        try {
          // @ts-ignore — plain ESM generator, shared with the seeding script
          const { generateMachineStrokes, toSpec } = await import("@/lib/composition.mjs");
          // a SECURITY DEFINER function that paints only into an empty archive
          await sb.rpc("paint_the_opening", { spec: toSpec(generateMachineStrokes(386)) });
        } catch {
          /* the canvas simply starts empty */
        }
        if (alive) await load(false);
        return;
      }

      const rows = (data as StrokeRow[] | null) ?? [];
      const loaded = rows.map(toStroke).reverse();
      engineRef.current?.setStrokes(loaded);
      setStrokes(loaded.length);
      setStats({
        machine: machines,
        humans: humanCount.count ?? 0,
        begun: (firstMark.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
      });
      setIgniting(false);
      setReady(true);
      } catch {
        setReady(true);
        setIgniting(false);
      }
    };

    void load();

    channel = sb
      .channel("ink-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "canvas_strokes" },
        (payload) => {
          const row = payload.new as StrokeRow;
          // machine strokes only ever arrive in the opening; the load pass counts them
          if (!row || row.source === "machine" || row.session_id === sessionRef.current) return;
          const stroke = toStroke(row);
          engineRef.current?.animateIn(stroke);
          setStats((s) => ({ ...s, humans: s.humans + 1 }));
          setStrokes((n) => n + 1);
          whisperIn("someone, somewhere, just left a mark.");
          pluck(NOTES[Math.floor(Math.random() * NOTES.length)], 0.5);
        },
      )
      .subscribe();

    presence = sb.channel("studio-present", {
      config: { presence: { key: sessionRef.current } },
    });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence?.presenceState() ?? {};
        const count = Object.keys(state).length;
        setPainters(Math.max(1, count));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void presence?.track({ joined: Date.now() });
      });

    return () => {
      alive = false;
      if (channel) void sb.removeChannel(channel);
      if (presence) void sb.removeChannel(presence);
    };
  }, [pluck, whisperIn]);

  /* ------------------------------------------------------------------ paint */

  const localCommit = useCallback(
    async (stroke: Omit<Stroke, "id" | "createdAt" | "source">) => {
      const engine = engineRef.current;
      if (!engine) return;

      const optimistic: Stroke = {
        ...stroke,
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        source: "human",
        session: sessionRef.current,
        createdAt: new Date().toISOString(),
      };
      engine.commit(optimistic);
      setStrokes((n) => n + 1);
      setMine((n) => n + 1);
      setStats((s) => ({ ...s, humans: s.humans + 1 }));
      pluck(NOTES[ink], 0.8);

      if (!supabase) return;

      const { error } = await supabase.from("canvas_strokes").insert({
        session_id: sessionRef.current,
        source: "human",
        color: stroke.color,
        alpha: stroke.alpha,
        width: stroke.width,
        points: stroke.points,
      });

      if (error) {
        say("the archive is unreachable — your ink stayed on this screen");
      } else if (firstStroke.current) {
        firstStroke.current = false;
        say("your ink is in the archive — it stays forever");
      }
    },
    [ink, pluck, say],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (replay.on) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const engine = engineRef.current;
      if (!engine) return;
      if (intro) setIntro(false);

      const rect = e.currentTarget.getBoundingClientRect();
      pointerRef.current = { id: e.pointerId, active: true };
      e.currentTarget.setPointerCapture(e.pointerId);
      engine.liveBegin(inkHex, width);
      engine.livePoint(e.clientX - rect.left, e.clientY - rect.top);
    },
    [replay.on, intro, inkHex, width],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerRef.current.active) return;
    const engine = engineRef.current;
    if (!engine) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
    const events = native.getCoalescedEvents?.() ?? [];
    if (events.length) {
      for (const ev of events) engine.livePoint(ev.clientX - rect.left, ev.clientY - rect.top);
    } else {
      engine.livePoint(e.clientX - rect.left, e.clientY - rect.top);
    }
  }, []);

  const endStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointerRef.current.active) return;
      pointerRef.current.active = false;
      try {
        e.currentTarget.releasePointerCapture(pointerRef.current.id);
      } catch {
        /* pointer already released */
      }
      const stroke = engineRef.current?.liveEnd();
      if (!stroke) return;
      void localCommit(stroke);
    },
    [localCommit],
  );

  /* ----------------------------------------------------------------- replay */

  const openReplay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const total = engine.replayState.total;
    if (total < 2) {
      say("nothing to replay yet — add the first strokes");
      return;
    }
    setIntro(false);
    setReplay({
      on: true,
      progress: 0,
      drawn: 0,
      total,
      complete: false,
      machineShare: Math.min(1, stats.machine / Math.max(1, total)),
    });
    const duration = Math.min(26000, Math.max(9000, total * 26));
    engine.startReplay(duration);
  }, [stats.machine, say]);

  const closeReplay = useCallback(() => {
    engineRef.current?.stopReplay();
    setReplay(EMPTY_REPLAY);
  }, []);

  const scrubTo = useCallback((clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    engineRef.current?.seekReplay(p);
  }, []);

  /* ---------------------------------------------------------------- actions */

  const toggleSound = useCallback(() => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSound(next);
    if (next) pluck(NOTES[2], 0.9);
  }, [pluck]);

  const share = useCallback(async () => {
    const url = window.location.origin;
    const text = "A painting no one will ever finish. Add a stroke.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "UNFINISHED ∞", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      say("link copied — hand someone the brush");
    } catch {
      say(url.replace(/^https?:\/\//, ""));
    }
  }, [say]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "escape") {
        if (replay.on) closeReplay();
        else if (intro) setIntro(false);
      } else if (k === "r") {
        if (replay.on) closeReplay();
        else openReplay();
      } else if (k === "m") {
        toggleSound();
      } else if (k === "enter" && intro) {
        setIntro(false);
      } else if (/^[1-7]$/.test(k)) {
        setInk(Number(k) - 1);
        pluck(NOTES[Number(k) - 1], 0.6);
      } else if (k === "[" || k === "]") {
        setSize((s) => Math.min(SIZES.length - 1, Math.max(0, s + (k === "]" ? 1 : -1))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replay.on, intro, openReplay, closeReplay, toggleSound, pluck]);

  const autoReplay = useRef(false);
  useEffect(() => {
    if (!ready || autoReplay.current) return;
    if (window.location.hash === "#replay" && engineRef.current?.replayState.total) {
      autoReplay.current = true;
      openReplay();
    }
  }, [ready, openReplay]);

  const machineLabel = useMemo(() => (stats.machine ? fmt(stats.machine) : "—"), [stats.machine]);

  return (
    <main className={`stage${replay.on ? " is-replaying" : ""}`}>
      <canvas
        ref={canvasRef}
        className={`paper${ready ? " is-ready" : ""}`}
        aria-label="A collaborative painting. Drag anywhere to add permanent ink."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onContextMenu={(e) => e.preventDefault()}
      />
      <canvas ref={tipRef} className="tip-layer" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      {!replay.on && (
        <div className="hud">
          <div className="hud-top">
            <div>
              <div className="brand">
                <span className="brand-mark">∞</span>
                <span className="brand-word">Unfinished</span>
              </div>
              <div className="brand-sub">
                {igniting ? "the machine is still painting…" : "a painting no one will finish"}
              </div>
            </div>

            <div className="hud-right">
              <span className="pill">
                <span className="dot" />
                {painters === 1 ? "only you, for now" : `${painters} painting now`}
              </span>
              <button className="ghost" type="button" onClick={toggleSound} data-on={sound}>
                sound {sound ? "on" : "off"}
              </button>
              <button className="ghost" type="button" onClick={() => setIntro(true)}>
                about
              </button>
            </div>
          </div>

          <div className="hud-bottom">
            <div className="readout">
              <span>
                machine <b>{machineLabel}</b>
              </span>
              <span>
                humans <b>{fmt(stats.humans)}</b>
              </span>
              <span>
                your marks <b>{fmt(mine)}</b>
              </span>
              {stats.begun && (
                <span>
                  begun{" "}
                  <b>
                    {new Date(stats.begun).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </b>
                </span>
              )}
              {!CONNECTED && <span style={{ color: "var(--vermilion)" }}>offline · local ink</span>}
            </div>

            <div className="toolbar" role="toolbar" aria-label="Brush and canvas controls">
              <div className="inks" role="group" aria-label="Ink colour">
                {PALETTE.map((c, i) => (
                  <button
                    key={c.name}
                    className="swatch"
                    type="button"
                    style={{ background: c.hex }}
                    aria-label={`${c.name} ink`}
                    aria-pressed={ink === i}
                    onClick={() => setInk(i)}
                  />
                ))}
              </div>

              <div className="rule" />

              <div className="sizes" role="group" aria-label="Brush weight">
                {SIZES.map((s, i) => (
                  <button
                    key={s.label}
                    className="size"
                    type="button"
                    aria-label={`${s.label} brush`}
                    aria-pressed={size === i}
                    onClick={() => setSize(i)}
                  >
                    <span style={{ width: 3 + i * 3, height: 3 + i * 3 }} />
                  </button>
                ))}
              </div>

              <div className="rule" />

              <button className="action" type="button" onClick={openReplay}>
                <span className="glyph">∞</span> replay
              </button>
              <button className="action" type="button" onClick={() => void share()}>
                share
              </button>
            </div>

            <div />
          </div>
        </div>
      )}

      {intro && !replay.on && (
        <div className="veil" onClick={() => setIntro(false)} role="presentation">
          <div className="veil-inner" onClick={(e) => e.stopPropagation()}>
            <span className="eyebrow">
              Unfinished ∞ · a canvas that will never be complete
            </span>
            <h1>
              The machine started a painting it <em>cannot finish</em>.
            </h1>
            <p>
              It laid down <b>{stats.machine ? machineLabel : "hundreds of"}</b> strokes in the
              dark — flowing, searching, going nowhere in particular. It has no idea what it is making.{" "}
              <b>That part was left for you.</b>
            </p>
            <p>
              {stats.humans === 0 ? (
                <>No human has touched it yet. You would be the first.</>
              ) : (
                <>
                  <b>{fmt(stats.humans)}</b> human{" "}
                  {stats.humans === 1 ? "mark has" : "marks have"} joined it so far. Everything you
                  draw is kept forever and appears — live — on the screens of everyone else in this
                  room.
                </>
              )}{" "}
              Nothing is ever erased. Nothing is ever finished.
            </p>
            <button className="cta" type="button" onClick={() => setIntro(false)}>
              add a stroke <span aria-hidden="true">→</span>
            </button>
            <div className="veil-hint">drag anywhere · press R to replay everything · 1–7 for ink</div>
          </div>
        </div>
      )}

      {replay.on && (
        <div className="replay">
          <div className="replay-head">
            <b>replay</b> · from the first stroke
            <br />
            {fmt(replay.total)} marks · {fmt(Math.round(replay.total * replay.machineShare))} by the
            machine
          </div>

          <button className="ghost replay-exit" type="button" onClick={closeReplay}>
            close · esc
          </button>

          {!replay.complete && (
            <div className="replay-count">
              {fmt(replay.drawn)}
              <small>of {fmt(replay.total)} strokes</small>
            </div>
          )}

          {replay.complete && (
            <div className="replay-end">
              <div>
                <h2>…and it continues.</h2>
                <p>
                  Every mark you just watched was made by someone — or by the machine, waiting. The
                  next one is whoever walks in.
                </p>
                <button className="cta" type="button" onClick={closeReplay}>
                  return to now <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}

          <div
            className="track"
            role="slider"
            aria-label="Replay position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(replay.progress * 100)}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubTo(e.clientX, e.currentTarget);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) scrubTo(e.clientX, e.currentTarget);
            }}
          >
            <div className="track-line">
              <div className="track-fill" style={{ width: `${replay.progress * 100}%` }} />
              <div className="track-head" style={{ left: `${replay.progress * 100}%` }} />
              {replay.machineShare > 0.01 && replay.machineShare < 0.99 && (
                <>
                  <div className="track-mark" style={{ left: `${replay.machineShare * 100}%` }} />
                  <div
                    className="track-label"
                    style={{ left: `${replay.machineShare * 100}%` }}
                  >
                    first human
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toast ? " is-on" : ""}`} aria-live="polite">
        {toast}
      </div>
      <div className={`whisper${whisper ? " is-on" : ""}`} aria-live="polite">
        {whisper}
      </div>
    </main>
  );
}
