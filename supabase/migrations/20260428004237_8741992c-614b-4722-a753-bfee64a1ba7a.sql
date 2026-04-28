CREATE TABLE IF NOT EXISTS public.emendas_orcamentarias_transparencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_emenda text NOT NULL,
  ano integer NOT NULL,
  tipo_emenda text NOT NULL,
  numero_emenda text,
  autor text,
  nome_autor text,
  parlamentar_id integer,
  casa text,
  partido text,
  uf text,
  localidade_gasto text,
  funcao text,
  subfuncao text,
  valor_empenhado numeric NOT NULL DEFAULT 0,
  valor_liquidado numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  valor_resto_inscrito numeric NOT NULL DEFAULT 0,
  valor_resto_cancelado numeric NOT NULL DEFAULT 0,
  valor_resto_pago numeric NOT NULL DEFAULT 0,
  documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  tema_ia text NOT NULL DEFAULT 'Outros',
  subtema_ia text,
  area_publica text,
  publico_beneficiado text,
  risco_execucao text NOT NULL DEFAULT 'Médio',
  estagio_execucao text NOT NULL DEFAULT 'Empenhada',
  resumo_ia text,
  confianca_ia numeric NOT NULL DEFAULT 0.5,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT emendas_orcamentarias_codigo_unique UNIQUE (codigo_emenda),
  CONSTRAINT emendas_orcamentarias_confianca_check CHECK (confianca_ia >= 0 AND confianca_ia <= 1),
  CONSTRAINT emendas_orcamentarias_risco_check CHECK (risco_execucao IN ('Baixo', 'Médio', 'Alto'))
);

ALTER TABLE public.emendas_orcamentarias_transparencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Emendas orcamentarias are publicly readable" ON public.emendas_orcamentarias_transparencia;
DROP POLICY IF EXISTS "Block public writes to emendas orcamentarias" ON public.emendas_orcamentarias_transparencia;

CREATE POLICY "Emendas orcamentarias are publicly readable"
ON public.emendas_orcamentarias_transparencia
FOR SELECT
USING (true);

CREATE POLICY "Block public writes to emendas orcamentarias"
ON public.emendas_orcamentarias_transparencia
FOR ALL
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_emendas_orc_ano ON public.emendas_orcamentarias_transparencia (ano DESC);
CREATE INDEX IF NOT EXISTS idx_emendas_orc_autor ON public.emendas_orcamentarias_transparencia (nome_autor);
CREATE INDEX IF NOT EXISTS idx_emendas_orc_partido ON public.emendas_orcamentarias_transparencia (partido);
CREATE INDEX IF NOT EXISTS idx_emendas_orc_uf ON public.emendas_orcamentarias_transparencia (uf);
CREATE INDEX IF NOT EXISTS idx_emendas_orc_tema ON public.emendas_orcamentarias_transparencia (tema_ia, subtema_ia);
CREATE INDEX IF NOT EXISTS idx_emendas_orc_tipo ON public.emendas_orcamentarias_transparencia (tipo_emenda);
CREATE INDEX IF NOT EXISTS idx_emendas_orc_valor_pago ON public.emendas_orcamentarias_transparencia (valor_pago DESC);
CREATE INDEX IF NOT EXISTS idx_emendas_orc_funcao ON public.emendas_orcamentarias_transparencia (funcao, subfuncao);

DROP TRIGGER IF EXISTS update_emendas_orcamentarias_transparencia_updated_at ON public.emendas_orcamentarias_transparencia;
CREATE TRIGGER update_emendas_orcamentarias_transparencia_updated_at
BEFORE UPDATE ON public.emendas_orcamentarias_transparencia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();