
-- Table to store individual deputy votes per votação for detail pages
CREATE TABLE public.votos_deputados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deputado_id integer NOT NULL,
  id_votacao text NOT NULL,
  voto text NOT NULL,
  ano integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(deputado_id, id_votacao)
);

-- Enable RLS
ALTER TABLE public.votos_deputados ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Votos deputados are publicly readable"
ON public.votos_deputados
FOR SELECT
USING (true);

-- Only service role can insert
CREATE POLICY "Only service role can insert votos_deputados"
ON public.votos_deputados
FOR INSERT
WITH CHECK (false);

-- Index for fast deputy lookups
CREATE INDEX idx_votos_deputados_dep_ano ON public.votos_deputados(deputado_id, ano);
CREATE INDEX idx_votos_deputados_votacao ON public.votos_deputados(id_votacao);

-- Add proposicao columns to votacoes for bill details
ALTER TABLE public.votacoes ADD COLUMN IF NOT EXISTS proposicao_tipo text;
ALTER TABLE public.votacoes ADD COLUMN IF NOT EXISTS proposicao_numero text;
ALTER TABLE public.votacoes ADD COLUMN IF NOT EXISTS proposicao_ementa text;
