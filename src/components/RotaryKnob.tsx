"use client";

import React, { useCallback, useRef } from "react";

interface RotaryKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  displayValue: string;
  accentColor?: string;
  onChange: (value: number) => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  if (Math.abs(endAngle - startAngle) < 0.5) return "";
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export default function RotaryKnob({
  label,
  value,
  min,
  max,
  step = 0.01,
  defaultValue,
  displayValue,
  accentColor = "#FF4F1F",
  onChange,
}: RotaryKnobProps) {
  const dragState = useRef<{ startY: number; startVal: number } | null>(null);

  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Sweep from -135 deg to +135 deg (270 deg analog potentiometer arc)
  const startAngle = -135;
  const endAngle = 135;
  const currentAngle = startAngle + normalized * (endAngle - startAngle);

  const quantize = useCallback(
    (raw: number) => {
      const clamped = Math.max(min, Math.min(max, raw));
      const snapped = Math.round(clamped / step) * step;
      return Number(snapped.toFixed(4));
    },
    [min, max, step]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, startVal: value };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dy = dragState.current.startY - e.clientY;
    const sensitivity = e.shiftKey ? 320 : 135;
    const delta = (dy / sensitivity) * (max - min);
    onChange(quantize(dragState.current.startVal + delta));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    dragState.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const increment = Math.max(step, (max - min) * 0.025);
    onChange(quantize(value + dir * increment));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const coarse = Math.max(step, (max - min) * 0.05);
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      onChange(quantize(value + coarse));
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(quantize(value - coarse));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    }
  };

  return (
    <div className="flex flex-col items-center select-none">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayValue}
        title={`${label}: ${displayValue} — Drag vertically to adjust, double-click to reset`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => onChange(defaultValue)}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        className="group relative flex h-[54px] w-[54px] cursor-ns-resize touch-none items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F1F]"
      >
        <svg viewBox="0 0 60 60" className="h-full w-full overflow-visible">
          {/* Background track arc */}
          <path
            d={describeArc(30, 30, 25, startAngle, endAngle)}
            fill="none"
            stroke="#CFC8B8"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Active value arc */}
          {normalized > 0.008 && (
            <path
              d={describeArc(30, 30, 25, startAngle, currentAngle)}
              fill="none"
              stroke={accentColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Milled anodized aluminum cap */}
        <div
          className="pointer-events-none absolute h-[38px] w-[38px] rounded-full border border-[#B8B09E] bg-gradient-to-b from-[#FFFFFF] to-[#E6E0D3] shadow-[0_3px_5px_rgba(24,23,21,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] transition-transform duration-75 group-hover:border-[#8F8776]"
          style={{ transform: `rotate(${currentAngle}deg)` }}
        >
          <span
            className="absolute top-[4px] left-1/2 h-[9px] w-[2.5px] -translate-x-1/2 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>

      <span className="font-mono-tech mt-1 text-[11px] font-semibold tracking-tight text-[#181715]">
        {displayValue}
      </span>
      <span className="text-[9.5px] font-medium tracking-[0.12em] text-[#6B655B] uppercase">
        {label}
      </span>
    </div>
  );
}
