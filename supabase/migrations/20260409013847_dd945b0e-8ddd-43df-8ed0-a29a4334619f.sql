CREATE TABLE public.votacao_temas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  votacao_id text NOT NULL,
  casa text NOT NULL CHECK (casa IN ('camara', 'senado')),
  tema text NOT NULL,
  confianca numeric NOT NULL DEFAULT 0.5,
  ano integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_votacao_temas_unique ON public.votacao_temas (votacao_id, casa);
CREATE INDEX idx_votacao_temas_ano ON public.votacao_temas (ano);
CREATE INDEX idx_votacao_temas_tema ON public.votacao_temas (tema);

ALTER TABLE public.votacao_temas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Temas are publicly readable"
ON public.votacao_temas FOR SELECT
USING (true);

CREATE POLICY "Only service role can insert temas"
ON public.votacao_temas FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only service role can update temas"
ON public.votacao_temas FOR UPDATE
USING (false);