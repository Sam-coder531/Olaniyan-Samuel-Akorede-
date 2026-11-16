# AKOREDE FM — Model AK-01

**Lagos Polyrhythm & Afrobeats Hardware Groovebox** · Crafted for **Olaniyan Samuel Akorede (`@Sam-coder531`)**

AKOREDE FM is a browser-native hardware groovebox inspired by classic 1970s EMI Lagos tape consoles and modern tactile field synthesizers. Every drum hit, Amapiano sub log-drum knock, Yoruba *gangan* talking-drum pitch bend, Rhodes MkI 9th-chord voicing, and kalimba tine pluck is synthesized in real time using pure Web Audio DSP — zero external audio samples required.

## Highlights

- **8 Custom Web Audio Synth Channels** — *Log Drum* (FM sub-wood bass), *Eko Kick*, *Lagos Rim / Clave*, *Shekere* (filtered gourd beads), *Conga* (open/slap membrane), *Talking Drum* (*gangan* tension-cord pitch glide), *Rhodes MkI* (9th & 6/9 chord voicings), and *Kalimba* (thumb-piano pluck).
- **True West African Polyrhythm Sequencer** — Independently cycle each track's loop length across `16`, `12`, `8`, `6`, and `5` steps, generate Bjorklund Euclidean timelines in one click, add velocity accents, and sculpt per-step basslines and chord progressions in the **Pitch Lane**.
- **60fps OLED Visualizer** — Switch between concentric geometric polyrhythm orbits (`ORBIT`), real-time phosphor waveform (`SCOPE`), and logarithmic peak-hold spectrum (`FFT`).
- **Master Analog FX Bus** — Vertical-drag rotary potentiometers for Tempo (`70–150 BPM` + `TAP BPM`), Pocket Swing (`0–65%`), Resonant DJ Filter (`220 Hz–19.5 kHz`), Stereo Plate Reverb + Dotted-8th Ping-Pong Delay (`Space`), and Tape Saturation (`Drive`).
- **6 Studio Presets + Procedural Groove Engine** — *Eko Midnight*, *Log Drum Fever*, *Kalakuta 1974*, *Palmwine Sunset*, *Third Mainland*, and *Gangan Cypher*, plus a genre-aware **Surprise** composer (`[R]`).
- **4-Bar Studio `.WAV` Bounce & URL Beat Sharing** — Render crystal-clear 44.1 kHz / 16-bit stereo WAV loops offline in milliseconds or share any pattern via compact `?b=` permalinks.
- **Live Supabase Community Beat Crate** — Press original grooves with generative polyrhythm vinyl labels to a globally persisted Supabase Postgres crate, spin community dubplates straight into the studio, and salute favorite beats.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Stop sequencer |
| `1` – `8` | Trigger live velocity pads (hold `Shift` for accent; arm `REC` to overdub) |
| `R` | Generate a fresh procedural Surprise Groove |
| `Shift + Click` | Toggle accented step on any sequencer keycap |

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To enable persistent global storage for the Community Beat Crate, copy `.env.example` to `.env.local`, apply `supabase/migrations/20261116000001_akorede_fm_beats.sql`, and add your Supabase URL and service role key. Without them, the studio runs seamlessly with curated starter dubplates and in-memory session storage.

---

`6.5244° N, 3.3792° E · Lagos, NG`
