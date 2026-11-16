"use client";

import React from "react";
import { BeatPattern, SleeveColor } from "@/lib/types";

const SLEEVE_PALETTES: Record<
  SleeveColor,
  { bg: string; ring: string; stroke: string; dot: string }
> = {
  vermilion: {
    bg: "#181615",
    ring: "#2D2826",
    stroke: "#FF5729",
    dot: "#FFD7C7",
  },
  palm: {
    bg: "#111D17",
    ring: "#21362C",
    stroke: "#22C55E",
    dot: "#DCFCE7",
  },
  ochre: {
    bg: "#1C1811",
    ring: "#332B1D",
    stroke: "#F59E0B",
    dot: "#FEF3C7",
  },
  indigo: {
    bg: "#121726",
    ring: "#222C47",
    stroke: "#60A5FA",
    dot: "#DBEAFE",
  },
  obsidian: {
    bg: "#141414",
    ring: "#292929",
    stroke: "#F5F2EB",
    dot: "#FF4F1F",
  },
  terracotta: {
    bg: "#231410",
    ring: "#3B221B",
    stroke: "#FB923C",
    dot: "#FFEDD5",
  },
};

interface BeatPatternDiscProps {
  pattern: BeatPattern;
  sleeveColor: SleeveColor;
  spinning?: boolean;
  size?: number;
}

/**
 * Generates a unique vinyl/polyrhythm geometric disc directly from a beat's
 * actual step-sequencer pattern — every pressed beat gets its own fingerprint.
 */
export default function BeatPatternDisc({
  pattern,
  sleeveColor,
  spinning = false,
  size = 64,
}: BeatPatternDiscProps) {
  const pal = SLEEVE_PALETTES[sleeveColor] ?? SLEEVE_PALETTES.vermilion;
  const cx = 50;
  const cy = 50;

  // Pick up to 4 most active tracks to render as interlocking geometric polygons
  const featured = pattern.tracks
    .filter((t) => !t.muted)
    .map((t) => {
      const hits: number[] = [];
      for (let i = 0; i < t.length; i++) {
        if (t.steps[i] > 0) hits.push(i);
      }
      return { length: t.length, hits };
    })
    .filter((t) => t.hits.length >= 2)
    .slice(0, 4);

  const radii = [40, 32, 24, 17];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 rounded-full shadow-sm ${spinning ? "animate-[spin_9s_linear_infinite]" : ""}`}
    >
      <circle cx={cx} cy={cy} r="49" fill={pal.bg} stroke="#CFC8B8" strokeWidth="1.5" />
      {radii.map((r) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={pal.ring}
          strokeWidth="0.9"
        />
      ))}

      {featured.map((tr, idx) => {
        const r = radii[idx];
        const pts = tr.hits.map((step) => {
          const angle = (step / tr.length) * Math.PI * 2 - Math.PI / 2;
          return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
          };
        });
        const polyPoints = pts
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ");

        return (
          <g key={idx} opacity={1 - idx * 0.16}>
            {pts.length >= 3 ? (
              <polygon
                points={polyPoints}
                fill="none"
                stroke={pal.stroke}
                strokeWidth={idx === 0 ? "1.6" : "1.1"}
                strokeLinejoin="round"
              />
            ) : (
              <line
                x1={pts[0].x}
                y1={pts[0].y}
                x2={pts[1].x}
                y2={pts[1].y}
                stroke={pal.stroke}
                strokeWidth="1.3"
              />
            )}
            {pts.slice(0, 8).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="1.8" fill={pal.dot} />
            ))}
          </g>
        );
      })}

      {/* Center vinyl spindle label */}
      <circle cx={cx} cy={cy} r="9.5" fill={pal.stroke} />
      <circle cx={cx} cy={cy} r="2.8" fill={pal.bg} />
    </svg>
  );
}
