"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "motion/react";
import dynamic from "next/dynamic";
import SubscribeForm from "./SubscribeForm";

const Scene = dynamic(() => import("./three/Scene"), { ssr: false });

/* --------------------------------------------------------------- */
/*  Beats — the text layer. Each one owns a window of the scroll.   */
/* --------------------------------------------------------------- */

type Beat = {
  id: string;
  from: number;
  to: number;
  eyebrow?: string;
  lines: { text: string; accent?: boolean }[];
  body?: string;
  stats?: { k: string; v: string }[];
  place: "left" | "center" | "right";
  size?: "hero" | "big" | "mid";
};

const BEATS: Beat[] = [
  {
    id: "hero",
    from: 0.0,
    to: 0.115,
    eyebrow: "Adaptive Audio · H3",
    lines: [{ text: "Silence," }, { text: "engineered.", accent: true }],
    body: "Scroll to take AirPods Pro apart, watch the world go quiet, and put it back together.",
    place: "left",
    size: "hero",
  },
  {
    id: "anatomy",
    from: 0.135,
    to: 0.25,
    eyebrow: "Anatomically honest",
    lines: [{ text: "Shaped by" }, { text: "ten thousand", accent: true }, { text: "ears." }],
    body: "A shorter stem, a softer tip, and a vent that lets pressure out — so it disappears the moment you stop thinking about it.",
    place: "right",
    size: "big",
  },
  {
    id: "close",
    from: 0.265,
    to: 0.365,
    lines: [{ text: "Look" }, { text: "closer.", accent: true }],
    body: "Every seam exists for a reason. Every millimetre is doing work.",
    place: "center",
    size: "big",
  },
  {
    id: "explode",
    from: 0.39,
    to: 0.53,
    eyebrow: "Nine hundred parts",
    lines: [{ text: "This is what" }, { text: "silence", accent: true }, { text: "is made of." }],
    place: "left",
    size: "big",
  },
  {
    id: "anc",
    from: 0.555,
    to: 0.68,
    eyebrow: "Active Noise Cancellation",
    lines: [{ text: "The world" }, { text: "goes quiet.", accent: true }],
    body: "Outward mics read the noise, inward mics read what reaches your ear, and H3 writes the inverse wave 48,000 times a second.",
    stats: [
      { k: "2×", v: "noise removed" },
      { k: "48k", v: "corrections / sec" },
    ],
    place: "left",
    size: "big",
  },
  {
    id: "transparency",
    from: 0.695,
    to: 0.79,
    eyebrow: "Transparency",
    lines: [{ text: "Or let it" }, { text: "back in.", accent: true }],
    body: "One tap and the street returns — filtered, softened, two milliseconds behind reality.",
    place: "right",
    size: "big",
  },
  {
    id: "spatial",
    from: 0.805,
    to: 0.9,
    eyebrow: "Personalised Spatial Audio",
    lines: [{ text: "Sound that" }, { text: "knows where", accent: true }, { text: "you are." }],
    body: "Head tracking anchors the mix to the room. Turn your head — the band stays in front of you.",
    place: "center",
    size: "big",
  },
  {
    id: "finale",
    from: 0.925,
    to: 1.001,
    eyebrow: "AirPods Pro",
    lines: [{ text: "Hear nothing." }, { text: "Feel everything.", accent: true }],
    place: "center",
    size: "big",
  },
];

/* --------------------------------------------------------------- */

function BeatLayer({
  beat,
  progress,
}: {
  beat: Beat;
  progress: MotionValue<number>;
}) {
  const { from, to } = beat;
  const span = to - from;

  // staggered line reveals, then a clean exit
  const inAt = from + span * 0.22;
  const outAt = to - span * 0.18;

  const opacity = useTransform(progress, [from, inAt, outAt, to], [0, 1, 1, 0]);
  const y = useTransform(progress, [from, to], [70, -70]);
  const blurRaw = useTransform(progress, [from, inAt, outAt, to], [14, 0, 0, 14]);
  const filter = useTransform(blurRaw, (b) => `blur(${b}px)`);

  const isFinale = beat.id === "finale";

  return (
    <div className={`beat beat--${beat.place} beat--${beat.size ?? "big"}`}>
      <motion.div
        className="beat__motion"
        style={{ opacity, y, filter, pointerEvents: isFinale ? "auto" : "none" }}
      >
      <div className="beat__inner">
        {beat.eyebrow && <p className="eyebrow">{beat.eyebrow}</p>}
        <h1 className={beat.size === "hero" ? "h-hero" : "h-big"}>
          {beat.lines.map((l, i) => (
            <motion.span
              key={i}
              className={`line${l.accent ? " grad" : ""}`}
              style={{
                opacity: useTransform(
                  progress,
                  [inAt + i * 0.008, inAt + 0.03 + i * 0.008],
                  [0, 1]
                ),
                y: useTransform(
                  progress,
                  [inAt + i * 0.008, inAt + 0.03 + i * 0.008],
                  [26, 0]
                ),
              }}
            >
              {l.text}
            </motion.span>
          ))}
        </h1>
        {beat.body && <p className="lede">{beat.body}</p>}
        {beat.stats && (
          <div className="stats">
            {beat.stats.map((s) => (
              <div className="stat" key={s.k}>
                <b>{s.k}</b>
                <span>{s.v}</span>
              </div>
            ))}
          </div>
        )}
        {isFinale && <SubscribeForm />}
      </div>
      </motion.div>
    </div>
  );
}

/* --------------------------------------------------------------- */

export default function Film() {
  const filmRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: filmRef,
    offset: ["start start", "end end"],
  });

  // spring-smooth so the camera never jitters
  const progress = useSpring(scrollYProgress, {
    stiffness: 78,
    damping: 26,
    mass: 0.5,
    restDelta: 0.0004,
  });

  const [pct, setPct] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) =>
    setPct(Math.floor(v * 100))
  );

  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const ok =
        !!(window.WebGLRenderingContext &&
          (c.getContext("webgl2") || c.getContext("webgl")));
      setWebgl(ok);
    } catch {
      setWebgl(false);
    }
  }, []);

  const barWidth = useTransform(progress, [0, 1], ["0%", "100%"]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.03], [1, 0]);

  return (
    <>
      <header className="nav">
        <span className="brand">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7.5 6.2a3.1 3.1 0 0 1 3.1 3.1v8.2a3.1 3.1 0 0 1-6.2 0V9.3A3.1 3.1 0 0 1 7.5 6.2Zm9 0a3.1 3.1 0 0 1 3.1 3.1v8.2a3.1 3.1 0 0 1-6.2 0V9.3a3.1 3.1 0 0 1 3.1-3.1Z"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
          AirPods Pro
        </span>
        <nav className="nav__links">
          <a href="#silence">Silence</a>
          <a href="#sound">Sound</a>
          <a href="#reserve">Reserve</a>
        </nav>
        <span className="pct">{String(pct).padStart(3, "0")}%</span>
      </header>

      <div className="film" ref={filmRef}>
        <div className="stage">
          {/* ---- 3D or fallback ---- */}
          <div className="canvasWrap">
            {webgl ? (
              <Suspense fallback={null}>
                <Scene progress={progress} />
              </Suspense>
            ) : (
              <div className="fallback3d">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/airpods/hero-case-open.webp" alt="AirPods Pro" />
              </div>
            )}
          </div>

          {/* ---- text beats ---- */}
          {BEATS.map((b) => (
            <BeatLayer key={b.id} beat={b} progress={progress} />
          ))}

          {/* ---- chrome ---- */}
          {webgl && <div className="stageGlow" />}
          <motion.div className="hint" style={{ opacity: hintOpacity }}>
            <span>Scroll</span>
            <i />
          </motion.div>

          <footer className="footer">
            <span>Concept product film · not affiliated with Apple Inc.</span>
            <span>Real-time WebGL · Next.js</span>
          </footer>

          <div className="vignette" />
          <div className="grain" />
        </div>
      </div>

      <motion.div className="progress" style={{ width: barWidth }} />
    </>
  );
}
