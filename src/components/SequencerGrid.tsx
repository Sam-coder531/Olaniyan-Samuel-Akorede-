"use client";

import React from "react";
import { Sparkles, Volume2 } from "lucide-react";
import { INSTRUMENTS, POLY_LENGTHS, SCALES } from "@/lib/music";
import {
  BeatPattern,
  EditMode,
  InstrumentId,
  PolyLength,
  StepVelocity,
} from "@/lib/types";

interface SequencerGridProps {
  pattern: BeatPattern;
  isPlaying: boolean;
  globalTick: number;
  selectedTrack: InstrumentId;
  editMode: EditMode;
  onSelectTrack: (id: InstrumentId, audition?: boolean) => void;
  onEditModeChange: (mode: EditMode) => void;
  onToggleStep: (
    trackId: InstrumentId,
    stepIdx: number,
    forceAccent: boolean
  ) => void;
  onChangeNote: (
    trackId: InstrumentId,
    stepIdx: number,
    nextDegree: number
  ) => void;
  onToggleMute: (trackId: InstrumentId) => void;
  onToggleSolo: (trackId: InstrumentId) => void;
  onCycleLength: (trackId: InstrumentId, nextLength: PolyLength) => void;
  onEuclideanFill: (trackId: InstrumentId) => void;
  onChangeVolume: (trackId: InstrumentId, vol: number) => void;
}

export default function SequencerGrid({
  pattern,
  isPlaying,
  globalTick,
  selectedTrack,
  editMode,
  onSelectTrack,
  onEditModeChange,
  onToggleStep,
  onChangeNote,
  onToggleMute,
  onToggleSolo,
  onCycleLength,
  onEuclideanFill,
  onChangeVolume,
}: SequencerGridProps) {
  const hasSolo = pattern.tracks.some((t) => t.solo);
  const scaleDef = SCALES[pattern.master.scale] ?? SCALES.f_minor;
  const focusedMeta =
    INSTRUMENTS.find((i) => i.id === selectedTrack) ?? INSTRUMENTS[0];
  const focusedTrack =
    pattern.tracks.find((t) => t.id === selectedTrack) ?? pattern.tracks[0];

  const handleLengthClick = (current: PolyLength, trackId: InstrumentId) => {
    const idx = POLY_LENGTHS.indexOf(current);
    const next = POLY_LENGTHS[(idx + 1) % POLY_LENGTHS.length];
    onCycleLength(trackId, next);
  };

  return (
    <div className="hardware-bay rounded-xl p-3 sm:p-4">
      {/* Sequencer header bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono-tech text-[10.5px] font-semibold tracking-[0.14em] text-[#59544B] uppercase">
            16-Step Polyrhythm Matrix
          </span>
          <span className="hidden text-[11px] text-[#867F73] md:inline">
            · Shift-click step for accent · Click step count (16/12/8/6/5) for
            cross-rhythms
          </span>
        </div>

        {/* Mode selector: STEP / ACCENT / PITCH */}
        <div className="flex items-center gap-1 rounded-lg border border-[#D2CBBB] bg-[#E3DDD0] p-0.5">
          {(
            [
              { id: "step", label: "Step" },
              { id: "accent", label: "Accent" },
              { id: "pitch", label: "Pitch Lane" },
            ] as const
          ).map((m) => {
            const active = editMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onEditModeChange(m.id);
                  if (m.id === "pitch" && !focusedMeta.tonal) {
                    onSelectTrack("logdrum", false);
                  }
                }}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  active
                    ? "bg-[#181715] text-[#F7F4ED] shadow-xs"
                    : "text-[#59544B] hover:text-[#181715]"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable matrix container for clean mobile ergonomics */}
      <div className="thin-scroll overflow-x-auto pb-1">
        <div className="min-w-[740px]">
          {/* Step number ruler */}
          <div className="mb-1.5 grid grid-cols-[248px_1fr] items-center gap-2.5">
            <div className="font-mono-tech flex items-center justify-between px-2 text-[9.5px] tracking-wider text-[#867F73] uppercase">
              <span>Channel</span>
              <span>M / S · Len · Euc · Vol</span>
            </div>
            <div className="grid grid-cols-16 gap-1">
              {Array.from({ length: 16 }, (_, idx) => {
                const isQuarter = idx % 4 === 0;
                const isPlayhead = isPlaying && globalTick % 16 === idx;
                return (
                  <div
                    key={idx}
                    className={`font-mono-tech flex items-center justify-center gap-0.5 text-[9.5px] ${
                      isPlayhead
                        ? "font-bold text-[#FF4F1F]"
                        : isQuarter
                          ? "font-semibold text-[#3E3A33]"
                          : "text-[#948D80]"
                    }`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8 Instrument rows */}
          <div className="space-y-1.5">
            {INSTRUMENTS.map((meta) => {
              const track = pattern.tracks.find((t) => t.id === meta.id)!;
              const isSelected = selectedTrack === meta.id;
              const isAudible = hasSolo ? track.solo : !track.muted;
              const trackStep = isPlaying ? globalTick % track.length : -1;

              return (
                <div
                  key={meta.id}
                  className={`grid grid-cols-[248px_1fr] items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors ${
                    isSelected
                      ? "bg-[#F9F7F2] ring-1 ring-[#CFC8B8]"
                      : "hover:bg-[#F4F0E7]/70"
                  } ${!isAudible ? "opacity-55" : ""}`}
                >
                  {/* Left: Instrument label + M/S + Polyrhythm Length + Euclidean + Vol */}
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectTrack(meta.id, true)}
                      title={`Audition & select ${meta.name} (Key ${meta.keyHint})`}
                      className="flex min-w-0 cursor-pointer items-center gap-2 text-left"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="truncate text-[12px] font-semibold tracking-tight text-[#181715]">
                        {meta.name}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleMute(meta.id)}
                        title={`Mute ${meta.name}`}
                        aria-pressed={track.muted}
                        className={`font-mono-tech h-5 w-5 cursor-pointer rounded text-[9.5px] font-bold transition-colors ${
                          track.muted
                            ? "bg-[#181715] text-[#F7F4ED]"
                            : "border border-[#CFC8B8] bg-[#F7F4ED] text-[#6B655B] hover:text-[#181715]"
                        }`}
                      >
                        M
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSolo(meta.id)}
                        title={`Solo ${meta.name}`}
                        aria-pressed={track.solo}
                        className={`font-mono-tech h-5 w-5 cursor-pointer rounded text-[9.5px] font-bold transition-colors ${
                          track.solo
                            ? "bg-[#FF4F1F] text-white"
                            : "border border-[#CFC8B8] bg-[#F7F4ED] text-[#6B655B] hover:text-[#181715]"
                        }`}
                      >
                        S
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLengthClick(track.length, meta.id)}
                        title={`Polyrhythm loop length: ${track.length} steps (click to cycle 16 → 12 → 8 → 6 → 5)`}
                        className={`font-mono-tech h-5 min-w-[26px] cursor-pointer rounded px-1 text-[9.5px] font-semibold transition-colors ${
                          track.length !== 16
                            ? "bg-[#15803D] text-white"
                            : "border border-[#CFC8B8] bg-[#F7F4ED] text-[#4A463E] hover:border-[#9E9685]"
                        }`}
                      >
                        {track.length}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEuclideanFill(meta.id)}
                        title={`Generate Euclidean rhythm for ${meta.name}`}
                        aria-label={`Generate Euclidean rhythm for ${meta.name}`}
                        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-[#CFC8B8] bg-[#F7F4ED] text-[#59544B] transition-colors hover:border-[#9E9685] hover:text-[#FF4F1F]"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={track.volume}
                        onChange={(e) =>
                          onChangeVolume(meta.id, Number(e.target.value))
                        }
                        aria-label={`${meta.name} volume`}
                        title={`${meta.name} volume: ${Math.round(track.volume * 100)}%`}
                        className="studio-fader ml-0.5 w-10"
                      />
                    </div>
                  </div>

                  {/* Right: 16 physical step pads */}
                  <div className="grid grid-cols-16 gap-1">
                    {track.steps.map((vel: StepVelocity, stepIdx: number) => {
                      const inLoop = stepIdx < track.length;
                      const isCurrent = inLoop && trackStep === stepIdx;
                      const isQuarterGroup = Math.floor(stepIdx / 4) % 2 === 1;
                      const isActive = inLoop && vel > 0;
                      const isAccent = inLoop && vel === 2;

                      if (!inLoop) {
                        return (
                          <div
                            key={stepIdx}
                            title={`Outside ${track.length}-step polyrhythm cycle`}
                            className="h-8 rounded-[6px] border border-dashed border-[#D3CCBC] bg-[#E2DCD0]/60"
                          />
                        );
                      }

                      return (
                        <button
                          key={stepIdx}
                          type="button"
                          onClick={(e) => {
                            if (editMode === "pitch" && meta.tonal) {
                              onSelectTrack(meta.id, false);
                              if (vel === 0) {
                                onToggleStep(meta.id, stepIdx, false);
                              } else {
                                const nextDeg =
                                  ((track.notes[stepIdx] ?? 0) + 1) % 8;
                                onChangeNote(meta.id, stepIdx, nextDeg);
                              }
                              return;
                            }
                            onToggleStep(
                              meta.id,
                              stepIdx,
                              e.shiftKey || editMode === "accent"
                            );
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            onToggleStep(meta.id, stepIdx, true);
                          }}
                          aria-label={`${meta.name} step ${stepIdx + 1}${
                            isAccent
                              ? " accented"
                              : isActive
                                ? " active"
                                : " off"
                          }`}
                          aria-pressed={isActive}
                          style={
                            isActive
                              ? {
                                  backgroundColor: meta.color,
                                  borderColor: meta.color,
                                  opacity: isAccent ? 1 : 0.76,
                                }
                              : undefined
                          }
                          className={`relative flex h-8 cursor-pointer flex-col items-center justify-between rounded-[6px] border p-1 transition-transform duration-75 active:translate-y-[1px] ${
                            isActive
                              ? "text-white shadow-[0_2px_0_rgba(24,23,21,0.22)]"
                              : isQuarterGroup
                                ? "border-[#CCC5B4] bg-[#F1ECE1] hover:border-[#ABA391]"
                                : "border-[#D2CBBB] bg-[#FCFBF8] shadow-[0_1.5px_0_#CEC6B5] hover:border-[#ABA391]"
                          } ${
                            isCurrent
                              ? "ring-2 ring-[#FF4F1F] ring-offset-1 ring-offset-[#EDE8DE]"
                              : ""
                          }`}
                        >
                          {/* Top mini LED bar */}
                          <span
                            className={`h-[3px] rounded-full transition-all ${
                              isAccent
                                ? "w-3.5 bg-white shadow-[0_0_5px_rgba(255,255,255,0.9)]"
                                : isActive
                                  ? "w-2 bg-white/80"
                                  : isCurrent
                                    ? "w-2 bg-[#FF4F1F]"
                                    : "w-1.5 bg-[#D4CDBD]"
                            }`}
                          />

                          {/* Show note name on active tonal steps */}
                          {meta.tonal && isActive && (
                            <span className="font-mono-tech text-[8px] leading-none font-semibold tracking-tighter text-white/95">
                              {meta.id === "rhodes"
                                ? scaleDef.chordNames[
                                    track.notes[stepIdx] ?? 0
                                  ]?.slice(0, 3)
                                : scaleDef.noteNames[track.notes[stepIdx] ?? 0]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Pitch / Chord Sequencer Drawer in Pitch Mode */}
          {editMode === "pitch" && (
            <div className="mt-3 rounded-lg border border-[#CFC8B8] bg-[#FAF8F2] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-3.5 w-3.5 text-[#FF4F1F]" />
                  <span className="text-[11.5px] font-semibold text-[#181715]">
                    Melodic Pitch Sequencer —
                  </span>
                  <div className="flex items-center gap-1">
                    {INSTRUMENTS.filter((i) => i.tonal).map((inst) => (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => onSelectTrack(inst.id, true)}
                        className={`cursor-pointer rounded px-2 py-0.5 text-[10.5px] font-semibold transition-colors ${
                          focusedMeta.id === inst.id
                            ? "bg-[#181715] text-white"
                            : "bg-[#EAE4D7] text-[#59544B] hover:text-[#181715]"
                        }`}
                      >
                        {inst.name}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="font-mono-tech text-[10px] text-[#6B655B]">
                  Scale: {scaleDef.label} · Click any column to step note
                </span>
              </div>

              {focusedMeta.tonal && (
                <div className="grid grid-cols-[248px_1fr] items-end gap-2.5">
                  <div className="font-mono-tech rounded-md bg-[#EFECE3] p-2 text-[10px] text-[#59544B]">
                    <div>
                      CHANNEL:{" "}
                      <strong className="text-[#181715]">
                        {focusedMeta.name.toUpperCase()}
                      </strong>
                    </div>
                    <div className="mt-0.5">
                      {focusedMeta.id === "rhodes"
                        ? "VOICING: 9th / 6-9 Chords"
                        : "REGISTER: Scale Degrees 1–8"}
                    </div>
                  </div>
                  <div className="grid grid-cols-16 gap-1">
                    {focusedTrack.notes.map((deg, idx) => {
                      const inLoop = idx < focusedTrack.length;
                      const active = inLoop && focusedTrack.steps[idx] > 0;
                      const label =
                        focusedMeta.id === "rhodes"
                          ? scaleDef.chordNames[deg]
                          : scaleDef.noteNames[deg];
                      const barPct = ((deg + 1) / 8) * 100;

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!inLoop}
                          onClick={() =>
                            onChangeNote(focusedMeta.id, idx, (deg + 1) % 8)
                          }
                          title={`Step ${idx + 1}: ${label} (click to transpose)`}
                          className={`group relative flex h-14 cursor-pointer flex-col items-center justify-end overflow-hidden rounded border text-center disabled:cursor-default disabled:opacity-35 ${
                            active
                              ? "border-[#B8B09E] bg-[#EFEAE0]"
                              : "border-[#DDD6C7] bg-[#F7F4ED] opacity-60 hover:opacity-100"
                          }`}
                        >
                          <div
                            className="w-full transition-all duration-100"
                            style={{
                              height: `${barPct}%`,
                              backgroundColor: active
                                ? focusedMeta.color
                                : "#CFC8B8",
                              opacity: active ? 0.85 : 0.5,
                            }}
                          />
                          <span
                            className={`font-mono-tech absolute bottom-1 text-[8.5px] font-bold ${
                              active ? "text-white drop-shadow-xs" : "text-[#4E4A42]"
                            }`}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
