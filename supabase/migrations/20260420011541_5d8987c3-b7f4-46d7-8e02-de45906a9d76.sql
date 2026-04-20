-- Add authorship column to proposicoes
ALTER TABLE public.proposicoes_parlamentares
  ADD COLUMN IF NOT EXISTS tipo_autoria text DEFAULT 'autor';

-- Add nolan diagram cache table
CREATE TABLE IF NOT EXISTS public.nolan_diagrams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parlamentar_id integer NOT NULL,
  casa text NOT NULL,
  ano integer NOT NULL,
  economic_axis numeric NOT NULL DEFAULT 0,
  social_axis numeric NOT NULL DEFAULT 0,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parlamentar_id, casa, ano)
);

ALTER TABLE public.nolan_diagrams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nolan diagrams publicly readable"
ON public.nolan_diagrams FOR SELECT
USING (true);

CREATE POLICY "Only service role can insert nolan diagrams"
ON public.nolan_diagrams FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only service role can update nolan diagrams"
ON public.nolan_diagrams FOR UPDATE
USING (false);

CREATE INDEX IF NOT EXISTS idx_nolan_diagrams_lookup ON public.nolan_diagrams (parlamentar_id, casa, ano);