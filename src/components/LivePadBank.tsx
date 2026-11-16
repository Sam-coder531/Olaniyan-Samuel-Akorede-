"use client";

import React from "react";
import { INSTRUMENTS } from "@/lib/music";
import { InstrumentId } from "@/lib/types";

interface LivePadBankProps {
  activePads: Partial<Record<InstrumentId, boolean>>;
  isRecording: boolean;
  onHitPad: (instrument: InstrumentId, accent: boolean) => void;
}

export default function LivePadBank({
  activePads,
  isRecording,
  onHitPad,
}: LivePadBankProps) {
  return (
    <div className="hardware-bay rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono-tech text-[10px] font-semibold tracking-[0.14em] text-[#59544B] uppercase">
          Live Velocity Pads · Keys [1–8]
        </span>
        {isRecording ? (
          <span className="font-mono-tech flex items-center gap-1.5 text-[10px] font-semibold text-[#D93C10]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF4F1F]" />
            OVERDUB ARMED — TAPS QUANTIZE TO LOOP
          </span>
        ) : (
          <span className="font-mono-tech hidden text-[10px] text-[#867F73] sm:inline">
            Tap pads to jam live · Arm REC to capture hits
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {INSTRUMENTS.map((inst) => {
          const lit = Boolean(activePads[inst.id]);
          return (
            <button
              key={inst.id}
              type="button"
              data-pressed={lit ? "true" : "false"}
              onPointerDown={(e) => {
                e.preventDefault();
                onHitPad(inst.id, e.shiftKey);
              }}
              className="hw-key group relative flex h-[58px] cursor-pointer flex-col justify-between rounded-lg p-2 text-left select-none"
              style={
                lit
                  ? {
                      borderColor: inst.color,
                      boxShadow: `0 0 0 1px ${inst.color}, 0 4px 12px -2px ${inst.color}55`,
                    }
                  : undefined
              }
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono-tech rounded bg-[#EAE4D7] px-1 py-0.5 text-[9px] font-bold leading-none text-[#4F4B43]">
                  {inst.keyHint}
                </span>
                <span
                  className="h-2 w-2 rounded-full transition-transform duration-75"
                  style={{
                    backgroundColor: lit ? inst.color : "#CFC8B8",
                    transform: lit ? "scale(1.35)" : "scale(1)",
                  }}
                />
              </div>
              <div className="truncate">
                <div className="truncate text-[11px] font-semibold leading-tight text-[#181715]">
                  {inst.name}
                </div>
                <div className="truncate text-[9px] text-[#7B756A]">
                  {inst.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
