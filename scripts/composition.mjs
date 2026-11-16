/**
 * The machine's half of the painting.
 *
 * One river of light crossing the dark: ivory hairlines drift along a spine,
 * cool pigments gather underneath it, and a small warm constellation is placed
 * where the eye wants to rest. Deterministic — the same seed always paints the
 * same beginning.
 */

export const INKS = {
  bone: "#F2EDE3",
  vermilion: "#FF5A36",
  saffron: "#FFC24D",
  celadon: "#37D3AE",
  cobalt: "#5B8CFF",
  iris: "#B07BFF",
  rose: "#FF6FA8",
};

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const round = (v, d = 5) => Math.round(v * 10 ** d) / 10 ** d;

function gauss(rand, mean, sigma) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v) * sigma;
}

/* A hand-drawn spine: the river everything else leans on. */
const SPINE = [
  [-0.08, 0.74],
  [0.14, 0.56],
  [0.38, 0.5],
  [0.6, 0.6],
  [0.82, 0.5],
  [1.08, 0.3],
];

function spineAt(t) {
  // Catmull-Rom through the control points
  const n = SPINE.length - 1;
  const x = clamp(t, 0, 0.9999) * n;
  const i = Math.floor(x);
  const f = x - i;
  const p0 = SPINE[Math.max(0, i - 1)];
  const p1 = SPINE[i];
  const p2 = SPINE[Math.min(n, i + 1)];
  const p3 = SPINE[Math.min(n, i + 2)];
  const cr = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
  return { x: cr(p0[0], p1[0], p2[0], p3[0]), y: cr(p0[1], p1[1], p2[1], p3[1]) };
}

function spineTangent(t) {
  const a = spineAt(Math.max(0, t - 0.004));
  const b = spineAt(Math.min(1, t + 0.004));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function tracer(rand, x, y, angle, steps, stepLen, curl, wobble) {
  const pts = [];
  const phase = rand() * TAU;
  for (let i = 0; i < steps; i++) {
    const local =
      angle +
      curl * Math.sin(i * 0.075 + phase) * 0.55 +
      wobble * Math.cos(i * 0.031 + phase * 1.7);
    x += Math.cos(local) * stepLen;
    y += Math.sin(local) * stepLen * 0.94;
    const taper = 0.82 + 0.34 * Math.sin(i * 0.13 + phase);
    pts.push([round(x), round(y), round(clamp(taper, 0.5, 1.3), 3)]);
  }
  return pts;
}

/* weighted ink draw — ivory carries the piece */
function ink(rand) {
  const r = rand();
  if (r < 0.66) return INKS.bone;
  if (r < 0.8) return INKS.cobalt;
  if (r < 0.89) return INKS.iris;
  if (r < 0.94) return INKS.celadon;
  if (r < 0.97) return INKS.saffron;
  return INKS.vermilion;
}

export function generateMachineStrokes(total = 420, seed = 20261116) {
  const rand = mulberry32(seed);
  const strokes = [];
  const push = (s) => {
    if (s.points.length >= 2) strokes.push(s);
  };

  /* 1. the river — ivory hairlines, the body and handwriting of the piece */
  const river = Math.round(total * 0.58);
  for (let i = 0; i < river; i++) {
    const t = clamp(gauss(rand, 0.52, 0.26), -0.05, 1.05);
    const p = spineAt(t);
    const tan = spineTangent(t);
    const off = gauss(rand, 0, 0.085);
    const x = p.x - tan.y * off;
    const y = p.y + tan.x * off;
    const angle = Math.atan2(tan.y, tan.x) + gauss(rand, 0, 0.22);
    const warm = rand() < 0.07;
    const color = warm ? (rand() < 0.6 ? INKS.saffron : INKS.vermilion) : ink(rand);
    push({
      color,
      alpha: round(0.09 + rand() * 0.16, 3),
      width: round(0.55 + rand() * 0.95, 2),
      points: tracer(rand, x, y, angle, 46 + Math.floor(rand() * 96), 0.0038 + rand() * 0.0028, 0.42, 0.22),
      source: "machine",
    });
  }

  /* 2. undertow — heavier cool ribbons beneath the river */
  const undertow = Math.round(total * 0.1);
  for (let i = 0; i < undertow; i++) {
    const t = clamp(gauss(rand, 0.55, 0.28), 0, 1);
    const p = spineAt(t);
    const tan = spineTangent(t);
    const off = gauss(rand, 0.03, 0.07);
    const color = rand() < 0.5 ? INKS.cobalt : rand() < 0.6 ? INKS.iris : INKS.celadon;
    push({
      color,
      alpha: round(0.08 + rand() * 0.12, 3),
      width: round(2.2 + rand() * 3.4, 2),
      points: tracer(
        rand,
        p.x - tan.y * off,
        p.y + tan.x * off,
        Math.atan2(tan.y, tan.x) + 0.1,
        40 + Math.floor(rand() * 60),
        0.0055,
        0.5,
        0.3,
      ),
      source: "machine",
    });
  }

  /* 3. constellation — warm marks, only where they earn it */
  const constellation = Math.round(total * 0.1);
  for (let i = 0; i < constellation; i++) {
    const p = spineAt(clamp(gauss(rand, 0.75, 0.16), 0.25, 1));
    const x = clamp(p.x + gauss(rand, 0, 0.14), 0.05, 0.97);
    const y = clamp(p.y + gauss(rand, 0, 0.2), 0.05, 0.95);
    const color = rand() < 0.62 ? INKS.vermilion : rand() < 0.85 ? INKS.saffron : INKS.rose;
    push({
      color,
      alpha: round(0.18 + rand() * 0.24, 3),
      width: round(0.9 + rand() * 1.6, 2),
      points: tracer(rand, x, y, rand() * TAU, 14 + Math.floor(rand() * 26), 0.0055, 1.4, 0.6),
      source: "machine",
    });
  }

  /* 4. gestures — a handful of lines that travel the whole frame */
  const gestures = Math.max(3, Math.round(total * 0.018));
  for (let i = 0; i < gestures; i++) {
    const t = clamp(rand() * 0.5, 0, 0.5);
    const p = spineAt(t);
    const tan = spineTangent(t);
    const color = rand() < 0.55 ? INKS.bone : INKS.cobalt;
    push({
      color,
      alpha: round(0.14 + rand() * 0.16, 3),
      width: round(1 + rand() * 1.4, 2),
      points: tracer(
        rand,
        p.x,
        p.y + gauss(rand, 0, 0.05),
        Math.atan2(tan.y, tan.x),
        230 + Math.floor(rand() * 120),
        0.0046,
        0.9,
        0.3,
      ),
      source: "machine",
    });
  }

  /* 4b. heroes — a few lines with enough weight to lead the eye */
  const heroes = Math.max(5, Math.round(total * 0.02));
  for (let i = 0; i < heroes; i++) {
    const t = clamp(rand() * 0.8, 0, 0.9);
    const p = spineAt(t);
    const tan = spineTangent(t);
    const off = gauss(rand, 0, 0.04);
    const color = rand() < 0.75 ? INKS.bone : rand() < 0.6 ? INKS.saffron : INKS.cobalt;
    push({
      color,
      alpha: round(0.34 + rand() * 0.22, 3),
      width: round(1 + rand() * 1.3, 2),
      points: tracer(
        rand,
        p.x - tan.y * off,
        p.y + tan.x * off,
        Math.atan2(tan.y, tan.x) + gauss(rand, 0, 0.08),
        120 + Math.floor(rand() * 110),
        0.0042,
        0.3,
        0.18,
      ),
      source: "machine",
    });
  }

  /* 4c. pressure — broad, quiet marks that give the drawing a body */
  const pressure = Math.max(6, Math.round(total * 0.03));
  for (let i = 0; i < pressure; i++) {
    const t = clamp(gauss(rand, 0.5, 0.28), 0, 1);
    const p = spineAt(t);
    const tan = spineTangent(t);
    const off = gauss(rand, 0, 0.09);
    const color = rand() < 0.3 ? INKS.bone : rand() < 0.55 ? INKS.cobalt : INKS.iris;
    push({
      color,
      alpha: round(0.028 + rand() * 0.04, 3),
      width: round(7 + rand() * 13, 2),
      points: tracer(
        rand,
        p.x - tan.y * off,
        p.y + tan.x * off,
        Math.atan2(tan.y, tan.x),
        30 + Math.floor(rand() * 40),
        0.0048,
        0.22,
        0.14,
      ),
      source: "machine",
    });
  }

  /* 5. dust — settled particles, the grain of the piece */
  const dust = Math.round(total * 0.07);
  for (let i = 0; i < dust; i++) {
    const t = clamp(gauss(rand, 0.5, 0.3), 0, 1);
    const p = spineAt(t);
    const x = clamp(p.x + gauss(rand, 0, 0.16), 0.02, 0.98);
    const y = clamp(p.y + gauss(rand, 0, 0.2), 0.02, 0.98);
    const r = 0.0012 + rand() * 0.0022;
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * TAU;
      pts.push([round(x + Math.cos(a) * r), round(y + Math.sin(a) * r * 1.2), 1]);
    }
    push({
      color: rand() < 0.7 ? INKS.bone : INKS.saffron,
      alpha: round(0.1 + rand() * 0.2, 3),
      width: round(1.6 + rand() * 2.4, 2),
      points: pts,
      source: "machine",
    });
  }

  return strokes;
}
