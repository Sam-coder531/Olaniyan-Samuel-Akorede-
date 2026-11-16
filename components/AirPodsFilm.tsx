"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValueEvent,
} from "motion/react";
import { Plate, Copy, Hotspot, Static, type Scene } from "./StickyScene";
import SubscribeForm from "./SubscribeForm";

/* The beats of the film. Windows are fractions of the total scroll. */
const SCENES: Scene[] = [
  {
    id: "hero",
    img: "/assets/airpods/hero-case-open.webp",
    alt: "AirPods rising out of an open charging case on a dark studio backdrop",
    from: 0,
    to: 0.14,
    scale: [1.1, 1],
    drift: [6, -2],
  },
  {
    id: "pair",
    img: "/assets/airpods/hero-buds-pair.webp",
    alt: "Two AirPods floating in mid-air",
    from: 0.13,
    to: 0.26,
    scale: [1.16, 0.98],
    rotate: [3, -3],
  },
  {
    id: "macro",
    img: "/assets/airpods/macro-detail.webp",
    alt: "Macro view of the AirPods speaker mesh and silicone tip",
    from: 0.25,
    to: 0.35,
    scale: [1.22, 1.02],
    drift: [10, -6],
  },
  {
    id: "exploded",
    img: "/assets/airpods/exploded-ebud.webp",
    alt: "Exploded technical view of one AirPod's internals",
    from: 0.345,
    to: 0.5,
    scale: [1.18, 0.9],
    drift: [12, -10],
    tall: true,
  },
  {
    id: "anc",
    img: "/assets/airpods/anc-waves.webp",
    alt: "Sound waves dissolving into silence at the AirPods",
    from: 0.49,
    to: 0.62,
    scale: [1.24, 1.0],
  },
  {
    id: "transparency",
    img: "/assets/airpods/transparency-mode.webp",
    alt: "A glass shell around the AirPods with wireframe city sounds flowing in",
    from: 0.61,
    to: 0.72,
    scale: [1.2, 1.0],
    rotate: [-2, 2],
  },
  {
    id: "spatial",
    img: "/assets/airpods/spatial-audio.webp",
    alt: "AirPods surrounded by orbital rings of sound",
    from: 0.71,
    to: 0.83,
    scale: [1.22, 1.0],
  },
  {
    id: "black",
    img: "/assets/airpods/case-closed-black.webp",
    alt: "Matte black AirPods case with a green charging light",
    from: 0.82,
    to: 0.9,
    scale: [1.3, 1.02],
    drift: [8, -4],
  },
  {
    id: "colors",
    img: "/assets/airpods/colors-lineup.webp",
    alt: "AirPods in four finishes: white, black, titanium, sand",
    from: 0.895,
    to: 0.975,
    scale: [1.18, 1.0],
    drift: [6, -2],
  },
];

export default function AirPodsFilm() {
  const filmRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: filmRef, offset: ["start start", "end end"] });

  // smoothing so the plates feel filmic rather than twitchy
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.4,
    restDelta: 0.0005,
  });

  const progressBar = useTransform(progress, [0, 1], ["0%", "100%"]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.04], [1, 0]);

  // nav / chrome state
  const [pct, setPct] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) =>
    setPct(Math.round(v * 100))
  );

  // keeps iOS from fighting the sticky stage
  useEffect(() => {
    document.documentElement.style.setProperty("--p", String(pct / 100));
  }, [pct]);

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
          <a href="#finish">Finish</a>
          <a href="#reserve">Reserve</a>
        </nav>
        <span style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
          {String(pct).padStart(3, "0")}%
        </span>
      </header>

      <div className="film" ref={filmRef}>
        <div className="stage">
          {/* ---------- opening frame ---------- */}
          <motion.div
            className="copy copy--left"
            style={{
              opacity: useTransform(progress, [0, 0.012, 0.075, 0.1], [0, 1, 1, 0]),
              y: useTransform(progress, [0, 0.1], [24, -60]),
            }}
          >
            <p className="eyebrow">Adaptive Audio · H3</p>
            <h1>
              Silence,
              <br />
              <span className="grad">engineered.</span>
            </h1>
            <p className="lede">
              Scroll to take AirPods Pro apart, watch the world go quiet, and put
              it all back together in a finish that suits you.
            </p>
            <motion.div
              className="hint"
              style={{ opacity: hintOpacity, position: "static", transform: "none", marginTop: 40 }}
            >
              <span>Scroll</span>
              <i />
            </motion.div>
          </motion.div>

          {/* ---------- the plates ---------- */}
          {SCENES.map((s) => (
            <Plate key={s.id} scene={s} progress={progress} />
          ))}

          {/* ---------- exploded-view callouts ---------- */}
          <Hotspot
            progress={progress}
            from={0.365}
            to={0.48}
            style={{ left: "16%", top: "17%" }}
            label="Custom silicone tip"
            detail="Four sizes, pressure-equalised"
            flip
          />
          <Hotspot
            progress={progress}
            from={0.375}
            to={0.48}
            style={{ right: "15%", top: "25%" }}
            label="Vented acoustic mesh"
            detail="Keeps the driver breathing"
          />
          <Hotspot
            progress={progress}
            from={0.385}
            to={0.48}
            style={{ left: "14%", top: "41%" }}
            label="H3 chip"
            detail="10 cores of audio math"
            flip
          />
          <Hotspot
            progress={progress}
            from={0.395}
            to={0.48}
            style={{ right: "14%", top: "52%" }}
            label="Battery cell"
            detail="6 hrs a charge, 30 with the case"
          />
          <Hotspot
            progress={progress}
            from={0.405}
            to={0.48}
            style={{ right: "18%", bottom: "17%" }}
            label="Force sensor stem"
            detail="Squeeze to control everything"
          />

          {/* ---------- copy beats ---------- */}
          <Copy progress={progress} from={0.15} to={0.255} place="bottom">
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              Anatomically honest
            </p>
            <h2>Shaped by ten thousand ears.</h2>
            <p className="lede center">
              A shorter stem, a softer tip and a vent that lets pressure out — so
              it disappears the moment you stop thinking about it.
            </p>
          </Copy>

          <Copy progress={progress} from={0.26} to={0.345} place="center" className="center">
            <h2 className="grad">Look closer.</h2>
            <p className="lede center">
              Every seam exists for a reason. Every millimetre is doing work.
            </p>
          </Copy>

          <Copy progress={progress} from={0.355} to={0.475} place="bottom">
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              Nine hundred parts
            </p>
            <h2>This is what silence is made of.</h2>
          </Copy>

          <Copy progress={progress} from={0.5} to={0.615} place="left" className="anchor-left">
            <p className="eyebrow" id="silence">
              Active Noise Cancellation
            </p>
            <h2>
              The world
              <br />
              <span className="grad">goes quiet.</span>
            </h2>
            <p className="lede">
              Outward mics read the noise, inward mics read what reaches your ear,
              and the H3 chip writes the inverse wave 48,000 times a second.
            </p>
            <div className="stats" style={{ justifyContent: "flex-start" }}>
              <div className="stat">
                <b>2×</b>
                <span>noise removed</span>
              </div>
              <div className="stat">
                <b>48k</b>
                <span>corrections / sec</span>
              </div>
            </div>
          </Copy>

          <Copy progress={progress} from={0.615} to={0.72} place="right" className="anchor-right">
            <p className="eyebrow">Transparency</p>
            <h2>Or let it back in.</h2>
            <p className="lede">
              One tap and the street returns — filtered, softened, and two
              milliseconds behind reality.
            </p>
          </Copy>

          <Copy progress={progress} from={0.72} to={0.825} place="center" className="center">
            <p className="eyebrow" style={{ justifyContent: "center" }} id="sound">
              Personalised Spatial Audio
            </p>
            <h2>
              Sound that
              <br />
              <span className="grad">knows where you are.</span>
            </h2>
            <p className="lede center">
              Head tracking anchors the mix to the room. Turn your head — the band
              stays in front of you.
            </p>
          </Copy>

          <Copy progress={progress} from={0.83} to={0.9} place="left">
            <p className="eyebrow">All night</p>
            <h2>Six hours.<br />Thirty with the case.</h2>
            <p className="lede">
              Five minutes on the pad buys an hour of listening. The case charges on
              MagSafe, on a cable, or on nothing at all.
            </p>
          </Copy>

          <Copy progress={progress} from={0.895} to={1.001} place="bottom">
            <p className="eyebrow" style={{ justifyContent: "center" }} id="finish">
              Four finishes
            </p>
            <h2>Pick your quiet.</h2>
            <div className="swatches" role="group" aria-label="Finishes">
              {[
                ["#f4f4f2", "White"],
                ["#111114", "Midnight"],
                ["#8d8d92", "Titanium"],
                ["#d9c9b4", "Sand"],
              ].map(([c, n], i) => (
                <button
                  key={n}
                  className="swatch"
                  style={{ background: c }}
                  aria-label={n}
                  aria-pressed={i === 0}
                  title={n}
                />
              ))}
            </div>
          </Copy>

          {/* ---------- closing frame ---------- */}
          <motion.div
            className="copy copy--center center"
            id="reserve"
            style={{
              opacity: useTransform(progress, [0.955, 0.99, 1], [0, 1, 1]),
              y: useTransform(progress, [0.955, 1], [40, 0]),
              background:
                "radial-gradient(60% 60% at 50% 50%, rgba(5,5,6,.92) 40%, rgba(5,5,6,.55) 100%)",
              padding: "6vh 4vw",
              borderRadius: 28,
              width: "min(92vw, 760px)",
            }}
          >
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              AirPods Pro
            </p>
            <h2>
              Hear nothing.
              <br />
              <span className="grad">Feel everything.</span>
            </h2>
            <SubscribeForm />
          </motion.div>

          <footer className="footer">
            <span>Concept product film · not affiliated with Apple Inc.</span>
            <span>
              Built with Next.js · imagery generated for this page
            </span>
          </footer>

          <div className="vignette" />
          <div className="grain" />
        </div>
      </div>

      <motion.div className="progress" style={{ width: progressBar }} />
    </>
  );
}
