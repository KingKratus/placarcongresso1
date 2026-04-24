
-- =====================================================
-- 1. CACHE DE TRAMITAÇÕES
-- =====================================================
CREATE TABLE public.tramitacoes_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casa text NOT NULL CHECK (casa IN ('camara','senado')),
  tipo text NOT NULL,
  numero text NOT NULL,
  ano integer NOT NULL,
  proposicao_id_externo text,
  ementa text,
  eventos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ultima_situacao text,
  ultima_atualizacao timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casa, tipo, numero, ano)
);

CREATE INDEX idx_tramitacoes_cache_lookup ON public.tramitacoes_cache (casa, tipo, numero, ano);
CREATE INDEX idx_tramitacoes_cache_fetched ON public.tramitacoes_cache (fetched_at DESC);

ALTER TABLE public.tramitacoes_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tramitacoes are publicly readable"
  ON public.tramitacoes_cache FOR SELECT
  USING (true);

CREATE POLICY "Only service role can insert tramitacoes"
  ON public.tramitacoes_cache FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only service role can update tramitacoes"
  ON public.tramitacoes_cache FOR UPDATE
  USING (false);

CREATE TRIGGER update_tramitacoes_cache_updated_at
  BEFORE UPDATE ON public.tramitacoes_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. PROPOSIÇÕES PRIORITÁRIAS (curadas)
-- =====================================================
CREATE TABLE public.proposicoes_prioritarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casa text NOT NULL CHECK (casa IN ('camara','senado')),
  tipo text NOT NULL,
  numero text NOT NULL,
  ano integer NOT NULL,
  titulo text NOT NULL,
  ementa text,
  tema text NOT NULL,
  url text,
  destaque boolean NOT NULL DEFAULT false,
  ativa boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casa, tipo, numero, ano)
);

CREATE INDEX idx_prioritarias_tema ON public.proposicoes_prioritarias (tema, ativa);
CREATE INDEX idx_prioritarias_ordem ON public.proposicoes_prioritarias (ordem ASC, created_at DESC);

ALTER TABLE public.proposicoes_prioritarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prioritárias are publicly readable"
  ON public.proposicoes_prioritarias FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert prioritárias"
  ON public.proposicoes_prioritarias FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "Admins can update prioritárias"
  ON public.proposicoes_prioritarias FOR UPDATE
  TO authenticated
  USING (public.has_role('admin'));

CREATE POLICY "Admins can delete prioritárias"
  ON public.proposicoes_prioritarias FOR DELETE
  TO authenticated
  USING (public.has_role('admin'));

CREATE TRIGGER update_prioritarias_updated_at
  BEFORE UPDATE ON public.proposicoes_prioritarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3. VOTOS DE PRIORIDADE (cidadãos)
-- =====================================================
CREATE TABLE public.prioridade_votos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proposicao_id uuid NOT NULL REFERENCES public.proposicoes_prioritarias(id) ON DELETE CASCADE,
  prioridade smallint NOT NULL CHECK (prioridade BETWEEN 0 AND 10),
  posicao text NOT NULL CHECK (posicao IN ('favor','contra','neutro')),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, proposicao_id)
);

CREATE INDEX idx_prioridade_votos_prop ON public.prioridade_votos (proposicao_id);
CREATE INDEX idx_prioridade_votos_user ON public.prioridade_votos (user_id);

ALTER TABLE public.prioridade_votos ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ler agregados via view; votos individuais só o dono vê
CREATE POLICY "Users can view own votes"
  ON public.prioridade_votos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own votes"
  ON public.prioridade_votos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON public.prioridade_votos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON public.prioridade_votos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_prioridade_votos_updated_at
  BEFORE UPDATE ON public.prioridade_votos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. VIEW DE AGREGAÇÃO (público)
-- =====================================================
CREATE OR REPLACE VIEW public.prioridade_agregada AS
SELECT
  p.id AS proposicao_id,
  p.casa,
  p.tipo,
  p.numero,
  p.ano,
  p.titulo,
  p.tema,
  COUNT(v.id)::int AS total_votos,
  COALESCE(ROUND(AVG(v.prioridade)::numeric, 2), 0) AS prioridade_media,
  COUNT(v.id) FILTER (WHERE v.posicao = 'favor')::int AS favor,
  COUNT(v.id) FILTER (WHERE v.posicao = 'contra')::int AS contra,
  COUNT(v.id) FILTER (WHERE v.posicao = 'neutro')::int AS neutro
FROM public.proposicoes_prioritarias p
LEFT JOIN public.prioridade_votos v ON v.proposicao_id = p.id
GROUP BY p.id;

GRANT SELECT ON public.prioridade_agregada TO anon, authenticated;
