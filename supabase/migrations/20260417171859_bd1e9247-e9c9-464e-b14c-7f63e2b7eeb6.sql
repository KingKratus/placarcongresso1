-- Performance scores table
CREATE TABLE public.deputy_performance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parlamentar_id integer NOT NULL,
  casa text NOT NULL,
  ano integer NOT NULL,
  nome text,
  partido text,
  uf text,
  foto text,
  score_alinhamento numeric NOT NULL DEFAULT 0,
  score_presenca numeric NOT NULL DEFAULT 0,
  score_impacto numeric NOT NULL DEFAULT 0,
  score_engajamento numeric NOT NULL DEFAULT 0,
  score_total numeric NOT NULL DEFAULT 0,
  dados_brutos jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parlamentar_id, casa, ano)
);

CREATE INDEX idx_perf_scores_lookup ON public.deputy_performance_scores (casa, ano, score_total DESC);
CREATE INDEX idx_perf_scores_parl ON public.deputy_performance_scores (parlamentar_id, casa);

ALTER TABLE public.deputy_performance_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Performance scores publicly readable"
  ON public.deputy_performance_scores FOR SELECT USING (true);

CREATE POLICY "Only service role can insert performance scores"
  ON public.deputy_performance_scores FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update performance scores"
  ON public.deputy_performance_scores FOR UPDATE USING (false);

CREATE TRIGGER trg_perf_scores_updated_at
  BEFORE UPDATE ON public.deputy_performance_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enrich proposicoes table
ALTER TABLE public.proposicoes_parlamentares
  ADD COLUMN IF NOT EXISTS status_tramitacao text,
  ADD COLUMN IF NOT EXISTS peso_tipo numeric DEFAULT 0.3;