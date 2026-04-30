
-- 1. Portal API quota
CREATE TABLE public.portal_api_quota (
  date date PRIMARY KEY DEFAULT CURRENT_DATE,
  requests_used integer NOT NULL DEFAULT 0,
  daily_limit integer NOT NULL DEFAULT 600,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_api_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quota is publicly readable" ON public.portal_api_quota FOR SELECT USING (true);
CREATE POLICY "Block public writes to quota" ON public.portal_api_quota FOR ALL USING (false) WITH CHECK (false);

-- 2. Sync query cache
CREATE TABLE public.sync_query_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  endpoint text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX idx_sync_query_cache_expires ON public.sync_query_cache(expires_at);
ALTER TABLE public.sync_query_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cache stats publicly readable" ON public.sync_query_cache FOR SELECT USING (true);
CREATE POLICY "Block public writes to cache" ON public.sync_query_cache FOR ALL USING (false) WITH CHECK (false);

-- 3. Análises ponderadas por IA
CREATE TABLE public.analises_ponderadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parlamentar_id integer NOT NULL,
  casa text NOT NULL,
  ano integer NOT NULL,
  nome text,
  partido text,
  uf text,
  score_tradicional numeric NOT NULL DEFAULT 0,
  score_ia numeric NOT NULL DEFAULT 0,
  total_votos integer NOT NULL DEFAULT 0,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parlamentar_id, casa, ano)
);
CREATE INDEX idx_analises_ponderadas_lookup ON public.analises_ponderadas(casa, ano);
ALTER TABLE public.analises_ponderadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Análises ponderadas publicly readable" ON public.analises_ponderadas FOR SELECT USING (true);
CREATE POLICY "Block public writes ponderadas" ON public.analises_ponderadas FOR ALL USING (false) WITH CHECK (false);

-- 4. Feature suggestions
CREATE TABLE public.feature_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  feature_key text NOT NULL,
  context text,
  vote integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feature_suggestions_key ON public.feature_suggestions(feature_key);
ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can insert suggestions" ON public.feature_suggestions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users see own suggestions" ON public.feature_suggestions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role('admin'::app_role));
CREATE POLICY "Aggregate counts publicly readable" ON public.feature_suggestions
  FOR SELECT TO anon USING (false);

-- 5. profile partido filiação
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS partido_filiacao text;

-- 6. Função de badges temáticas
CREATE OR REPLACE FUNCTION public.get_parlamentar_badges(_parlamentar_id integer, _casa text, _ano integer)
RETURNS TABLE(tema text, total integer, sim integer, nao integer, ratio numeric, badge text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH votos AS (
    SELECT vt.tema, vd.voto
    FROM votos_deputados vd
    JOIN votacao_temas vt ON vt.votacao_id = vd.id_votacao AND vt.casa = 'camara' AND vt.ano = vd.ano
    WHERE _casa = 'camara' AND vd.deputado_id = _parlamentar_id AND vd.ano = _ano
    UNION ALL
    SELECT vt.tema, vs.voto
    FROM votos_senadores vs
    JOIN votacao_temas vt ON vt.votacao_id = vs.codigo_sessao_votacao AND vt.casa = 'senado' AND vt.ano = vs.ano
    WHERE _casa = 'senado' AND vs.senador_id = _parlamentar_id AND vs.ano = _ano
  ), agg AS (
    SELECT 
      v.tema,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE lower(v.voto) IN ('sim','yes','favoravel','favorável','aprovado'))::int AS sim,
      COUNT(*) FILTER (WHERE lower(v.voto) IN ('nao','não','no','contrario','contrário','rejeitado'))::int AS nao
    FROM votos v
    GROUP BY v.tema
    HAVING COUNT(*) >= 5
  )
  SELECT 
    a.tema, a.total, a.sim, a.nao,
    ROUND((a.sim::numeric / NULLIF(a.total,0)) * 100, 1) AS ratio,
    CASE
      WHEN a.sim::numeric / NULLIF(a.total,0) >= 0.7 THEN 'Pró-' || a.tema
      WHEN a.nao::numeric / NULLIF(a.total,0) >= 0.7 THEN 'Anti-' || a.tema
      ELSE NULL
    END AS badge
  FROM agg a
  WHERE (a.sim::numeric / NULLIF(a.total,0) >= 0.7 OR a.nao::numeric / NULLIF(a.total,0) >= 0.7)
  ORDER BY a.total DESC
  LIMIT 5;
$$;
