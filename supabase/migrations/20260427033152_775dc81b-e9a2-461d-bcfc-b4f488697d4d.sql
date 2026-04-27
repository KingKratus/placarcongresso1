CREATE TABLE IF NOT EXISTS public.emendas_parlamentares_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parlamentar_id integer NOT NULL,
  casa text NOT NULL,
  parlamentar_nome text,
  tipo text NOT NULL DEFAULT 'EMD',
  numero text NOT NULL,
  ano integer NOT NULL,
  proposicao_tipo text,
  proposicao_numero text,
  proposicao_ano integer,
  ementa text,
  situacao text,
  valor numeric,
  data_apresentacao timestamp with time zone,
  url text,
  tema text NOT NULL DEFAULT 'Outros',
  impacto_estimado text NOT NULL DEFAULT 'Médio',
  area_politica text,
  publico_afetado text,
  tipo_beneficio text,
  resumo_ia text,
  confianca numeric NOT NULL DEFAULT 0.5,
  source text NOT NULL DEFAULT 'api',
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT emendas_casa_check CHECK (casa IN ('camara', 'senado')),
  CONSTRAINT emendas_impacto_check CHECK (impacto_estimado IN ('Baixo', 'Médio', 'Alto')),
  CONSTRAINT emendas_confianca_check CHECK (confianca >= 0 AND confianca <= 1)
);

ALTER TABLE public.emendas_parlamentares_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Emendas parlamentares are publicly readable" ON public.emendas_parlamentares_cache;
DROP POLICY IF EXISTS "Block public writes to emendas parlamentares" ON public.emendas_parlamentares_cache;

CREATE POLICY "Emendas parlamentares are publicly readable"
ON public.emendas_parlamentares_cache
FOR SELECT
USING (true);

CREATE POLICY "Block public writes to emendas parlamentares"
ON public.emendas_parlamentares_cache
FOR ALL
USING (false)
WITH CHECK (false);

CREATE UNIQUE INDEX IF NOT EXISTS emendas_unique_idx ON public.emendas_parlamentares_cache (
  parlamentar_id,
  casa,
  tipo,
  numero,
  ano,
  COALESCE(proposicao_tipo, ''),
  COALESCE(proposicao_numero, ''),
  COALESCE(proposicao_ano, 0)
);
CREATE INDEX IF NOT EXISTS idx_emendas_parlamentar_lookup ON public.emendas_parlamentares_cache (parlamentar_id, casa, ano DESC);
CREATE INDEX IF NOT EXISTS idx_emendas_tema ON public.emendas_parlamentares_cache (tema);
CREATE INDEX IF NOT EXISTS idx_emendas_situacao ON public.emendas_parlamentares_cache (situacao);
CREATE INDEX IF NOT EXISTS idx_emendas_proposicao ON public.emendas_parlamentares_cache (proposicao_tipo, proposicao_numero, proposicao_ano);

DROP TRIGGER IF EXISTS update_emendas_parlamentares_cache_updated_at ON public.emendas_parlamentares_cache;
CREATE TRIGGER update_emendas_parlamentares_cache_updated_at
BEFORE UPDATE ON public.emendas_parlamentares_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();