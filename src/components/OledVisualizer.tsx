"use client";

import React, { useEffect, useRef } from "react";
import { INSTRUMENTS, SCALES, getPolySignature } from "@/lib/music";
import {
  BeatPattern,
  InstrumentId,
  VisualizerMode,
} from "@/lib/types";

interface OledVisualizerProps {
  pattern: BeatPattern;
  isPlaying: boolean;
  globalTick: number;
  mode: VisualizerMode;
  onModeChange: (mode: VisualizerMode) => void;
  getAnalyser: () => AnalyserNode | null;
  lastTriggersRef: React.RefObject<Record<InstrumentId, number>>;
}

const OLED_RING_COLORS: Record<InstrumentId, string> = {
  logdrum: "#FF5A2C",
  kick: "#F5F2EB",
  rim: "#FBBF24",
  shekere: "#34D399",
  conga: "#FB923C",
  gangan: "#60A5FA",
  rhodes: "#FB7185",
  kalimba: "#2DD4BF",
};

export default function OledVisualizer({
  pattern,
  isPlaying,
  globalTick,
  mode,
  onModeChange,
  getAnalyser,
  lastTriggersRef,
}: OledVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const patternRef = useRef(pattern);
  const playingRef = useRef(isPlaying);
  const tickRef = useRef(globalTick);
  const modeRef = useRef(mode);
  const peaksRef = useRef<number[]>(new Array(32).fill(0));

  patternRef.current = pattern;
  playingRef.current = isPlaying;
  tickRef.current = globalTick;
  modeRef.current = mode;

  useEffect(() => {
    let rafId = 0;
    const timeData = new Uint8Array(1024);
    const freqData = new Uint8Array(512);

    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const targetW = Math.max(1, Math.round(rect.width * dpr));
        const targetH = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          const w = rect.width;
          const h = rect.height;
          ctx.clearRect(0, 0, w, h);

          // Subtle OLED dot graticule
          ctx.strokeStyle = "rgba(245, 242, 235, 0.045)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.moveTo(w / 2, 0);
          ctx.lineTo(w / 2, h);
          ctx.stroke();

          const curMode = modeRef.current;
          const curPattern = patternRef.current;
          const playing = playingRef.current;
          const tick = tickRef.current;
          const triggers = lastTriggersRef.current;

          if (curMode === "orbit") {
            const cx = w * 0.5;
            const cy = h * 0.5;
            const maxR = Math.min(w, h) * 0.44;
            const minR = maxR * 0.24;
            const hasSolo = curPattern.tracks.some((t) => t.solo);

            // Filter visible audible tracks with active hits
            const activeTracks = curPattern.tracks.filter((tr) => {
              const audible = hasSolo ? tr.solo : !tr.muted;
              return audible && tr.steps.slice(0, tr.length).some((s) => s > 0);
            });

            const count = Math.max(1, activeTracks.length);

            activeTracks.forEach((tr, idx) => {
              const r =
                count === 1
                  ? maxR * 0.72
                  : maxR - (idx / (count - 1)) * (maxR - minR);
              const color = OLED_RING_COLORS[tr.id];
              const lastHit = triggers?.[tr.id] ?? 0;
              const age = Math.max(0, now - lastHit);
              const flash = Math.exp(-age / 150);

              // Orbit ring
              ctx.beginPath();
              ctx.arc(cx, cy, r, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(245, 242, 235, ${0.07 + flash * 0.16})`;
              ctx.lineWidth = 1;
              ctx.stroke();

              // Collect active vertices
              const pts: { x: number; y: number; step: number; vel: number }[] =
                [];
              for (let s = 0; s < tr.length; s++) {
                const vel = tr.steps[s];
                if (vel > 0) {
                  const angle = (s / tr.length) * Math.PI * 2 - Math.PI / 2;
                  pts.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle),
                    step: s,
                    vel,
                  });
                }
              }

              // Polyrhythm polygon connecting hits
              if (pts.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                  ctx.lineTo(pts[i].x, pts[i].y);
                }
                if (pts.length >= 3) ctx.closePath();
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.26 + flash * 0.62;
                ctx.lineWidth = 1 + flash * 1.1;
                ctx.stroke();
                ctx.globalAlpha = 1;
              }

              // Nodes
              const activeStep = playing ? tick % tr.length : -1;
              for (const pt of pts) {
                const isNow = pt.step === activeStep;
                ctx.beginPath();
                ctx.arc(
                  pt.x,
                  pt.y,
                  isNow ? 3.8 : pt.vel === 2 ? 2.4 : 1.7,
                  0,
                  Math.PI * 2
                );
                ctx.fillStyle = isNow ? "#FFFFFF" : color;
                ctx.globalAlpha = isNow ? 1 : 0.72 + flash * 0.28;
                ctx.fill();
                ctx.globalAlpha = 1;
              }

              // Playhead cursor dot per distinct track cycle
              if (playing && activeStep >= 0) {
                const pAngle =
                  (activeStep / tr.length) * Math.PI * 2 - Math.PI / 2;
                const px = cx + r * Math.cos(pAngle);
                const py = cy + r * Math.sin(pAngle);
                ctx.beginPath();
                ctx.arc(px, py, 2.1, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                ctx.fill();
              }
            });

            // Center beacon
            const kickFlash = Math.exp(
              -Math.max(0, now - (triggers?.kick ?? 0)) / 140
            );
            const logFlash = Math.exp(
              -Math.max(0, now - (triggers?.logdrum ?? 0)) / 170
            );
            const idlePulse = playing
              ? 0
              : (Math.sin(now / 700) * 0.5 + 0.5) * 0.35;
            const coreR =
              3.5 + Math.max(kickFlash, logFlash) * 4.5 + idlePulse * 1.5;

            ctx.beginPath();
            ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
            ctx.fillStyle = "#FF5526";
            ctx.fill();

            // Subtle side instrument legend on wide OLED screens
            if (w >= 270) {
              INSTRUMENTS.slice(0, 4).forEach((inst, i) => {
                const f = Math.exp(
                  -Math.max(0, now - (triggers?.[inst.id] ?? 0)) / 160
                );
                const y = 16 + i * 16;
                ctx.fillStyle = OLED_RING_COLORS[inst.id];
                ctx.globalAlpha = 0.3 + f * 0.7;
                ctx.fillRect(10, y, 4 + f * 8, 4);
                ctx.globalAlpha = 1;
              });
              INSTRUMENTS.slice(4, 8).forEach((inst, i) => {
                const f = Math.exp(
                  -Math.max(0, now - (triggers?.[inst.id] ?? 0)) / 160
                );
                const y = 16 + i * 16;
                const bw = 4 + f * 8;
                ctx.fillStyle = OLED_RING_COLORS[inst.id];
                ctx.globalAlpha = 0.3 + f * 0.7;
                ctx.fillRect(w - 10 - bw, y, bw, 4);
                ctx.globalAlpha = 1;
              });
            }
          } else if (curMode === "scope") {
            const analyser = getAnalyser();
            if (analyser && playing) {
              analyser.getByteTimeDomainData(timeData);
            } else {
              for (let i = 0; i < timeData.length; i++) {
                const idle = Math.sin(i * 0.035 + now * 0.0025) * 3;
                timeData[i] = 128 + idle;
              }
            }

            // Soft phosphor glow pass
            ctx.beginPath();
            const slice = w / 256;
            for (let i = 0; i < 256; i++) {
              const v = (timeData[i * 2] - 128) / 128;
              const x = i * slice;
              const y = h / 2 + v * (h * 0.42);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = "rgba(255, 85, 38, 0.28)";
            ctx.lineWidth = 5;
            ctx.stroke();

            // Crisp core trace
            ctx.strokeStyle = "#FF6438";
            ctx.lineWidth = 1.8;
            ctx.stroke();
          } else {
            // FFT Spectrum analyzer
            const analyser = getAnalyser();
            if (analyser && playing) {
              analyser.getByteFrequencyData(freqData);
            } else {
              freqData.fill(0);
            }

            const bars = 28;
            const padX = 14;
            const usableW = w - padX * 2;
            const gap = 3;
            const barW = Math.max(2, (usableW - gap * (bars - 1)) / bars);
            const maxBarH = h - 28;
            const baseY = h - 14;

            for (let i = 0; i < bars; i++) {
              // Logarithmic bin sampling across 40Hz - 14kHz
              const norm = i / (bars - 1);
              const bin = Math.min(
                freqData.length - 1,
                Math.floor(Math.pow(norm, 1.9) * 260) + 1
              );
              const level = (freqData[bin] ?? 0) / 255;
              const barH = Math.max(2, level * maxBarH);

              const peaks = peaksRef.current;
              if (level > (peaks[i] ?? 0)) {
                peaks[i] = level;
              } else {
                peaks[i] = Math.max(0, (peaks[i] ?? 0) - 0.012);
              }

              const x = padX + i * (barW + gap);
              ctx.fillStyle = level > 0.72 ? "#FF5526" : "#34D399";
              ctx.globalAlpha = playing ? 0.88 : 0.25;
              ctx.fillRect(x, baseY - barH, barW, barH);

              if (peaks[i] > 0.03) {
                const peakY = baseY - peaks[i] * maxBarH - 2;
                ctx.fillStyle = "#F5F2EB";
                ctx.globalAlpha = 0.85;
                ctx.fillRect(x, peakY, barW, 1.5);
              }
              ctx.globalAlpha = 1;
            }
          }

          ctx.restore();
        }
      }
      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [getAnalyser, lastTriggersRef]);

  const scaleInfo = SCALES[pattern.master.scale] ?? SCALES.f_minor;
  const polySig = getPolySignature(pattern.tracks);
  const displayStep = isPlaying
    ? String((globalTick % 16) + 1).padStart(2, "0")
    : "01";

  return (
    <div className="oled-screen flex h-full min-h-[192px] flex-col justify-between rounded-xl p-3 text-[#F5F2EB]">
      {/* Top OLED telemetry strip */}
      <div className="font-mono-tech flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 text-[10px] tracking-wider">
        <div className="flex items-center gap-2 truncate">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              isPlaying
                ? "bg-[#FF5526] shadow-[0_0_8px_#FF5526]"
                : "bg-[#4A504D]"
            }`}
          />
          <span className="truncate font-semibold text-[#F5F2EB] uppercase">
            {pattern.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 text-[#A5ACA8]">
          <span>{scaleInfo.shortLabel}</span>
          <span className="text-[#FF6A40]">{pattern.master.bpm} BPM</span>
        </div>
      </div>

      {/* Live 60fps Canvas */}
      <div className="relative my-1 flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-label="Real-time polyrhythm orbit and audio oscilloscope"
        />
      </div>

      {/* Bottom OLED status & view switcher */}
      <div className="font-mono-tech flex items-center justify-between gap-2 border-t border-white/10 pt-1.5 text-[9.5px]">
        <div className="flex items-center gap-2.5 text-[#8E9691]">
          <span>
            STEP <strong className="text-[#F5F2EB]">{displayStep}</strong>/16
          </span>
          <span className="hidden sm:inline">
            POLY <strong className="text-[#34D399]">{polySig}</strong>
          </span>
        </div>

        <div
          className="flex items-center gap-0.5 rounded bg-white/[0.06] p-0.5"
          role="tablist"
          aria-label="OLED Visualizer Mode"
        >
          {(
            [
              { id: "orbit", label: "ORBIT" },
              { id: "scope", label: "SCOPE" },
              { id: "spectrum", label: "FFT" },
            ] as const
          ).map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onModeChange(item.id)}
                className={`cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-medium tracking-wider transition-colors ${
                  active
                    ? "bg-[#FF4F1F] text-white"
                    : "text-[#9AA19D] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
