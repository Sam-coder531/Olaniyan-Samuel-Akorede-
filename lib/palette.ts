export type Ink = { name: string; hex: string };

/** Seven inks. Cool pigments dominate; two warm accents carry the eye. */
export const PALETTE: Ink[] = [
  { name: "bone", hex: "#F2EDE3" },
  { name: "vermilion", hex: "#FF5A36" },
  { name: "saffron", hex: "#FFC24D" },
  { name: "celadon", hex: "#37D3AE" },
  { name: "cobalt", hex: "#5B8CFF" },
  { name: "iris", hex: "#B07BFF" },
  { name: "rose", hex: "#FF6FA8" },
];

/** Base widths in 1/1000ths of the shorter viewport edge. */
export const SIZES = [
  { label: "thin", width: 2.4 },
  { label: "fine", width: 4.6 },
  { label: "bold", width: 9 },
  { label: "wide", width: 17 },
];

export const MACHINE_ALPHA_MAX = 0.62;
export const HUMAN_ALPHA = 0.97;

export const MACHINE_LIMIT = 2500;
