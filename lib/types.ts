/**
 * A point on a stroke.
 * x, y  — normalized 0..1 canvas coordinates (resolution independent)
 * w     — width multiplier at that point (calligraphic taper: fast = thin, slow = thick)
 */
export type Pt = [number, number, number];

export type Source = "human" | "machine";

export type Stroke = {
  /** stable id: "db-<rowid>" for stored ink, "tmp-..." while in flight */
  id: string;
  color: string;
  alpha: number;
  /** base width, expressed in 1/1000ths of the canvas' shorter edge */
  width: number;
  points: Pt[];
  source: Source;
  createdAt: string;
  session?: string | null;
};

/** Row shape returned by PostgREST */
export type StrokeRow = {
  id: number;
  created_at: string;
  session_id: string | null;
  source: Source;
  color: string;
  alpha: number;
  width: number;
  points: Pt[];
};

export const toStroke = (row: StrokeRow): Stroke => ({
  id: `db-${row.id}`,
  color: row.color,
  alpha: row.alpha,
  width: row.width,
  points: Array.isArray(row.points) ? row.points : [],
  source: row.source,
  createdAt: row.created_at,
  session: row.session_id,
});
