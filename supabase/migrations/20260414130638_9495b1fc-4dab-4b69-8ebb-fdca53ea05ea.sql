
CREATE TABLE public.proposicoes_parlamentares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parlamentar_id integer NOT NULL,
  casa text NOT NULL,
  tipo text NOT NULL,
  numero text NOT NULL,
  ano integer NOT NULL,
  ementa text,
  tema text,
  url text,
  data_apresentacao timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(parlamentar_id, casa, tipo, numero, ano)
);

ALTER TABLE public.proposicoes_parlamentares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proposicoes are publicly readable"
ON public.proposicoes_parlamentares
FOR SELECT
USING (true);

CREATE POLICY "Only service role can insert proposicoes"
ON public.proposicoes_parlamentares
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only service role can update proposicoes"
ON public.proposicoes_parlamentares
FOR UPDATE
USING (false);

CREATE INDEX idx_proposicoes_parlamentar ON public.proposicoes_parlamentares(parlamentar_id, casa);
CREATE INDEX idx_proposicoes_tema ON public.proposicoes_parlamentares(tema);
CREATE INDEX idx_proposicoes_tipo ON public.proposicoes_parlamentares(tipo);
