"use client";

import React from "react";
import { Disc3, Flame, Headphones, Pause, Play, Plus } from "lucide-react";
import { GENRES, SCALES } from "@/lib/music";
import { CommunityBeat, GenreTag } from "@/lib/types";
import BeatPatternDisc from "./BeatPatternDisc";

interface CommunityCrateProps {
  beats: CommunityBeat[];
  loading: boolean;
  storage: "supabase" | "memory";
  sort: "trending" | "latest";
  genreFilter: GenreTag | "All";
  activeBeatId: string | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onSortChange: (sort: "trending" | "latest") => void;
  onGenreChange: (genre: GenreTag | "All") => void;
  onLoadBeat: (beat: CommunityBeat) => void;
  onLikeBeat: (beat: CommunityBeat) => void;
  onOpenPublish: () => void;
}

export default function CommunityCrate({
  beats,
  loading,
  storage,
  sort,
  genreFilter,
  activeBeatId,
  isPlaying,
  likedIds,
  onSortChange,
  onGenreChange,
  onLoadBeat,
  onLikeBeat,
  onOpenPublish,
}: CommunityCrateProps) {
  return (
    <section id="crate" aria-labelledby="crate-heading" className="mt-10">
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                storage === "supabase"
                  ? "bg-[#16A34A] shadow-[0_0_6px_rgba(22,163,74,0.65)]"
                  : "bg-[#D97706]"
              }`}
            />
            <span className="font-mono-tech text-[10.5px] font-semibold tracking-[0.14em] text-[#59544B] uppercase">
              {storage === "supabase"
                ? "Live Supabase Crate · Global Dubplates"
                : "Studio Crate · Session Dubplates"}
            </span>
          </div>
          <h2
            id="crate-heading"
            className="text-xl font-bold tracking-tight text-[#181715] sm:text-2xl"
          >
            Community Beat Crate
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-[#CFC8B8] bg-[#F4F0E7] p-0.5">
            {(["trending", "latest"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSortChange(s)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  sort === s
                    ? "bg-[#181715] text-[#F7F4ED]"
                    : "text-[#59544B] hover:text-[#181715]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenPublish}
            className="hw-key flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#181715]"
          >
            <Plus className="h-3.5 w-3.5 text-[#FF4F1F]" />
            Press Current Beat
          </button>
        </div>
      </div>

      {/* Genre shelf filter */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {(["All", ...GENRES] as const).map((g) => {
          const active = genreFilter === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => onGenreChange(g)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-[#FF4F1F] text-white"
                  : "border border-[#D2CBBB] bg-[#F7F4ED] text-[#59544B] hover:border-[#B5AD9B] hover:text-[#181715]"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-[146px] animate-pulse rounded-xl border border-[#D5CFC1] bg-[#F4F0E7]"
            />
          ))}
        </div>
      ) : beats.length === 0 ? (
        <div className="hardware-chassis flex flex-col items-center justify-center rounded-2xl py-12 text-center">
          <Disc3 className="mb-2 h-7 w-7 text-[#867F73]" />
          <p className="text-sm font-semibold text-[#181715]">
            No pressings on the {genreFilter} shelf yet
          </p>
          <p className="mt-1 text-xs text-[#6B655B]">
            Sculpt a pattern upstairs and press the very first dubplate.
          </p>
          <button
            type="button"
            onClick={onOpenPublish}
            className="hw-key-orange mt-4 cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold"
          >
            Press First {genreFilter} Beat
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {beats.map((beat) => {
            const isLoaded = activeBeatId === beat.id;
            const isSpinning = isLoaded && isPlaying;
            const isLiked = likedIds.has(beat.id);
            const scaleLabel =
              SCALES[beat.scale]?.shortLabel ?? SCALES.f_minor.shortLabel;

            return (
              <article
                key={beat.id}
                className={`group flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                  isLoaded
                    ? "border-[#FF4F1F] bg-[#FCFBF8] shadow-[0_8px_24px_-12px_rgba(255,79,31,0.35)]"
                    : "border-[#D2CBBB] bg-[#F7F4ED] hover:border-[#B6AE9C] hover:bg-[#FAF8F3]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <BeatPatternDisc
                    pattern={beat.pattern}
                    sleeveColor={beat.sleeve_color}
                    spinning={isSpinning}
                    size={58}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono-tech rounded bg-[#EAE4D7] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#4E4A42]">
                        {beat.genre}
                      </span>
                      <span className="font-mono-tech text-[10px] text-[#787166]">
                        {beat.bpm} BPM · {scaleLabel}
                      </span>
                    </div>
                    <h3 className="mt-1.5 truncate text-[14px] font-bold tracking-tight text-[#181715]">
                      {beat.title}
                    </h3>
                    <p className="truncate text-[11.5px] text-[#666055]">
                      {beat.producer} · {beat.city}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#E5DFD2] pt-2.5">
                  <div className="font-mono-tech flex items-center gap-3 text-[10.5px] text-[#6B655B]">
                    <span
                      className="flex items-center gap-1"
                      title="Studio spins"
                    >
                      <Headphones className="h-3 w-3" />
                      {beat.plays}
                    </span>
                    <span title="Polyrhythm cycle ratio">
                      POLY {beat.poly_signature}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onLikeBeat(beat)}
                      aria-pressed={isLiked}
                      title={isLiked ? "Saluted" : "Salute this groove"}
                      className={`font-mono-tech flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                        isLiked
                          ? "border-[#FF4F1F]/40 bg-[#FFF1EC] text-[#D93C10]"
                          : "border-[#D2CBBB] bg-white text-[#59544B] hover:border-[#B4AC9A] hover:text-[#181715]"
                      }`}
                    >
                      <Flame
                        className={`h-3 w-3 ${isLiked ? "fill-[#FF4F1F] text-[#FF4F1F]" : ""}`}
                      />
                      {beat.likes}
                    </button>

                    <button
                      type="button"
                      onClick={() => onLoadBeat(beat)}
                      className={`flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        isSpinning
                          ? "bg-[#FF4F1F] text-white"
                          : "bg-[#181715] text-[#F7F4ED] hover:bg-[#2F2D29]"
                      }`}
                    >
                      {isSpinning ? (
                        <>
                          <Pause className="h-3 w-3 fill-current" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 fill-current" />
                          Spin
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
