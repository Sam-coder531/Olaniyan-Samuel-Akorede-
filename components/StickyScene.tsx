"use client";

import { MotionValue, useTransform, motion } from "motion/react";
import type { ReactNode } from "react";

/* ---------------------------------------------------------------- */
/*  Stage helpers: everything is driven by one master scroll value   */
/* ---------------------------------------------------------------- */

export type Scene = {
  id: string;
  img: string;
  alt: string;
  /** scroll window, 0–1 of the whole film */
  from: number;
  to: number;
  /** scale at the ends of the window */
  scale?: [number, number];
  /** vertical drift in % of viewport height */
  drift?: [number, number];
  /** rotate at the ends, degrees */
  rotate?: [number, number];
  tall?: boolean;
};

type PlateProps = {
  scene: Scene;
  progress: MotionValue<number>;
};

export function Plate({ scene, progress }: PlateProps) {
  const [f, t] = [scene.from, scene.to];
  const mid = (f + t) / 2;

  // fade in from the previous scene, hold, fade out into the next
  const opacity = useTransform(
    progress,
    [f, f + (mid - f) * 0.34, t - (t - mid) * 0.34, t],
    [0, 1, 1, 0]
  );

  const scale = useTransform(
    progress,
    [f, t],
    scene.scale ?? [1.14, 0.94]
  );

  const y = useTransform(progress, [f, t], scene.drift ?? [8, -8]);

  const rotate = useTransform(progress, [f, t], scene.rotate ?? [0, 0]);

  return (
    <motion.div
      className="layer"
      style={{ opacity, pointerEvents: "none" }}
      aria-hidden={false}
    >
      <motion.div
        className={`plate${scene.tall ? " tall" : ""}`}
        style={{
          scale,
          rotate,
          y: useTransform(y, (v) => `${v}vh`),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scene.img} alt={scene.alt} loading="eager" decoding="async" />
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */
/*  Copy blocks — 2D typography that crossfades alongside the plates */
/* ---------------------------------------------------------------- */

type CopyProps = {
  progress: MotionValue<number>;
  from: number;
  to: number;
  place?: "left" | "right" | "bottom" | "center";
  className?: string;
  children: ReactNode;
};

export function Copy({
  progress,
  from,
  to,
  place = "left",
  className = "",
  children,
}: CopyProps) {
  const mid = (from + to) / 2;
  const inAt = from + (mid - from) * 0.3;
  const outAt = to - (to - mid) * 0.22;

  const opacity = useTransform(
    progress,
    [from, inAt, outAt, to],
    [0, 1, 1, 0]
  );
  const y = useTransform(progress, [from, to], [46, -46]);
  const blur = useTransform(progress, [from, inAt, outAt, to], [8, 0, 0, 8]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  return (
    <motion.div
      className={`copy copy--${place} ${className}`}
      style={{ opacity, y, filter }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */
/*  Hotspots — the technical callouts over the exploded view          */
/* ---------------------------------------------------------------- */

type HotspotProps = {
  progress: MotionValue<number>;
  from: number;
  to: number;
  style: React.CSSProperties;
  label: string;
  detail: string;
  flip?: boolean;
};

export function Hotspot({
  progress,
  from,
  to,
  style,
  label,
  detail,
  flip,
}: HotspotProps) {
  const opacity = useTransform(progress, [from, from + 0.02, to - 0.02, to], [
    0, 1, 1, 0,
  ]);
  const x = useTransform(progress, [from, to], [flip ? 26 : -26, 0]);
  const lineScale = useTransform(progress, [from, from + 0.03], [0, 1]);

  return (
    <motion.div
      className={`hotspot${flip ? " hotspot--flip" : ""}`}
      style={{ ...style, opacity, x }}
    >
      <motion.span
        className="hotspot__dot"
        style={{ scale: useTransform(opacity, [0, 1], [0.4, 1]) }}
      />
      <motion.span
        className="hotspot__line"
        style={{ scaleX: lineScale, transformOrigin: flip ? "right" : "left" }}
      />
      <span className="hotspot__text">
        {label}
        <b>{detail}</b>
      </span>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */
/*  A scene that never scrolls: the opening / closing frames          */
/* ---------------------------------------------------------------- */

type StaticProps = {
  children: ReactNode;
  className?: string;
};

export function Static({ children, className = "" }: StaticProps) {
  return <div className={`layer ${className}`}>{children}</div>;
}
