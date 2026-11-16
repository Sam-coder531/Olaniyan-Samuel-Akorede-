-- AKOREDE FM — Community Polyrhythm Crate schema
-- Isolated with `akorede_fm_` prefix and Row Level Security enabled.

CREATE TABLE IF NOT EXISTS public.akorede_fm_beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  producer text NOT NULL CHECK (char_length(producer) BETWEEN 1 AND 40),
  city text NOT NULL DEFAULT 'Lagos, NG' CHECK (char_length(city) BETWEEN 1 AND 40),
  genre text NOT NULL CHECK (genre IN ('Afrobeats', 'Amapiano', 'Afrobeat', 'Highlife', 'Afro-Tech')),
  sleeve_color text NOT NULL DEFAULT 'vermilion' CHECK (sleeve_color IN ('vermilion', 'palm', 'ochre', 'indigo', 'obsidian', 'terracotta')),
  bpm integer NOT NULL CHECK (bpm BETWEEN 70 AND 150),
  scale text NOT NULL CHECK (scale IN ('f_minor', 'd_dorian', 'g_major', 'a_minor', 'eb_major')),
  poly_signature text NOT NULL DEFAULT '16/16',
  pattern jsonb NOT NULL,
  likes integer NOT NULL DEFAULT 1 CHECK (likes >= 0),
  plays integer NOT NULL DEFAULT 0 CHECK (plays >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_akorede_fm_beats_created_at
  ON public.akorede_fm_beats (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_akorede_fm_beats_likes
  ON public.akorede_fm_beats (likes DESC, created_at DESC);

ALTER TABLE public.akorede_fm_beats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read akorede_fm_beats" ON public.akorede_fm_beats;
CREATE POLICY "Public can read akorede_fm_beats"
  ON public.akorede_fm_beats
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.akorede_fm_increment_likes(target_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.akorede_fm_beats
  SET likes = likes + 1
  WHERE id = target_id
  RETURNING likes;
$$;

CREATE OR REPLACE FUNCTION public.akorede_fm_increment_plays(target_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.akorede_fm_beats
  SET plays = plays + 1
  WHERE id = target_id
  RETURNING plays;
$$;
