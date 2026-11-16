"use client";

import React, { useState } from "react";
import { Disc3, X } from "lucide-react";
import { SLEEVE_COLORS } from "@/lib/codec";
import { GENRES, SCALES, getPolySignature } from "@/lib/music";
import { BeatPattern, CommunityBeat, GenreTag, SleeveColor } from "@/lib/types";
import BeatPatternDisc from "./BeatPatternDisc";

interface PublishModalProps {
  pattern: BeatPattern;
  onClose: () => void;
  onPublished: (beat: CommunityBeat, storage: "supabase" | "memory") => void;
}

const COLOR_SWATCH: Record<SleeveColor, { label: string; hex: string }> = {
  vermilion: { label: "Vermilion", hex: "#FF4F1F" },
  palm: { label: "Palm", hex: "#15803D" },
  ochre: { label: "Ochre", hex: "#D97706" },
  indigo: { label: "Indigo", hex: "#2563EB" },
  obsidian: { label: "Obsidian", hex: "#181715" },
  terracotta: { label: "Terracotta", hex: "#C2410C" },
};

export default function PublishModal({
  pattern,
  onClose,
  onPublished,
}: PublishModalProps) {
  const [title, setTitle] = useState(pattern.title || "Lagos Tape #01");
  const [producer, setProducer] = useState("@Sam-coder531");
  const [city, setCity] = useState("Lagos, NG");
  const [genre, setGenre] = useState<GenreTag>(pattern.genre);
  const [sleeveColor, setSleeveColor] = useState<SleeveColor>("vermilion");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scaleInfo = SCALES[pattern.master.scale] ?? SCALES.f_minor;
  const polySig = getPolySignature(pattern.tracks);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled Tape",
          producer: producer.trim() || "Anonymous",
          city: city.trim() || "Lagos, NG",
          genre,
          sleeveColor,
          pattern: { ...pattern, title: title.trim() || pattern.title, genre },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not press beat. Try again.");
        setSubmitting(false);
        return;
      }
      onPublished(data.beat, data.storage);
      onClose();
    } catch {
      setError("Network error while pressing beat.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#181715]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="press-modal-title"
    >
      <div className="hardware-chassis w-full max-w-md rounded-2xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc3 className="h-4 w-4 text-[#FF4F1F]" />
            <h2
              id="press-modal-title"
              className="text-base font-bold tracking-tight text-[#181715]"
            >
              Press Groove to Community Crate
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="hw-key flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#59544B]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Live Vinyl Pressing Preview */}
        <div className="hardware-bay mb-4 flex items-center gap-3.5 rounded-xl p-3">
          <BeatPatternDisc
            pattern={pattern}
            sleeveColor={sleeveColor}
            spinning
            size={64}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-[#181715]">
              {title || "Untitled Tape"}
            </div>
            <div className="truncate text-xs text-[#59544B]">
              {producer || "Anonymous"} · {city || "Lagos, NG"}
            </div>
            <div className="font-mono-tech mt-1 flex flex-wrap gap-2 text-[10px] text-[#6B655B]">
              <span>{pattern.master.bpm} BPM</span>
              <span>· {scaleInfo.shortLabel}</span>
              <span>· POLY {polySig}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="font-mono-tech mb-1 block text-[10px] font-semibold tracking-wider text-[#59544B] uppercase">
              Track Title
            </label>
            <input
              type="text"
              required
              maxLength={48}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ikoyi Rooftop 02:00"
              className="w-full rounded-lg border border-[#CFC8B8] bg-white px-3 py-2 text-sm text-[#181715] focus:border-[#FF4F1F] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="font-mono-tech mb-1 block text-[10px] font-semibold tracking-wider text-[#59544B] uppercase">
                Producer Tag
              </label>
              <input
                type="text"
                required
                maxLength={36}
                value={producer}
                onChange={(e) => setProducer(e.target.value)}
                placeholder="@Sam-coder531"
                className="w-full rounded-lg border border-[#CFC8B8] bg-white px-3 py-2 text-sm text-[#181715] focus:border-[#FF4F1F] focus:outline-none"
              />
            </div>
            <div>
              <label className="font-mono-tech mb-1 block text-[10px] font-semibold tracking-wider text-[#59544B] uppercase">
                City / Studio
              </label>
              <input
                type="text"
                maxLength={36}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lagos, NG"
                className="w-full rounded-lg border border-[#CFC8B8] bg-white px-3 py-2 text-sm text-[#181715] focus:border-[#FF4F1F] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="font-mono-tech mb-1 block text-[10px] font-semibold tracking-wider text-[#59544B] uppercase">
                Genre Shelf
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as GenreTag)}
                className="w-full rounded-lg border border-[#CFC8B8] bg-white px-2.5 py-2 text-sm text-[#181715] focus:border-[#FF4F1F] focus:outline-none"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono-tech mb-1 block text-[10px] font-semibold tracking-wider text-[#59544B] uppercase">
                Vinyl Label
              </label>
              <div className="flex h-[38px] items-center gap-1.5 rounded-lg border border-[#CFC8B8] bg-white px-2.5">
                {SLEEVE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={COLOR_SWATCH[c].label}
                    aria-label={COLOR_SWATCH[c].label}
                    onClick={() => setSleeveColor(c)}
                    className={`h-5 w-5 cursor-pointer rounded-full transition-transform ${
                      sleeveColor === c
                        ? "scale-115 ring-2 ring-[#181715] ring-offset-1"
                        : "opacity-75 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: COLOR_SWATCH[c].hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs font-medium text-[#991B1B]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="hw-key cursor-pointer rounded-lg px-3.5 py-2 text-xs font-semibold text-[#4A463E]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="hw-key-orange cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {submitting ? "Pressing Dubplate…" : "Press to Global Crate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
