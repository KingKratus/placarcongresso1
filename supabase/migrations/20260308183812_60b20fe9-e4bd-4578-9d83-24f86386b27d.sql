
-- analises_senadores table
CREATE TABLE IF NOT EXISTS public.analises_senadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  senador_id integer NOT NULL,
  senador_nome text NOT NULL,
  senador_partido text,
  senador_uf text,
  senador_foto text,
  ano integer NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  total_votos integer NOT NULL DEFAULT 0,
  votos_alinhados integer NOT NULL DEFAULT 0,
  classificacao classificacao_tipo NOT NULL DEFAULT 'Sem Dados',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(senador_id, ano)
);

ALTER TABLE public.analises_senadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Analises senadores are publicly readable" ON public.analises_senadores FOR SELECT USING (true);
CREATE POLICY "Only service role can insert analises senadores" ON public.analises_senadores FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update analises senadores" ON public.analises_senadores FOR UPDATE USING (false);

-- votacoes_senado table
CREATE TABLE IF NOT EXISTS public.votacoes_senado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_sessao_votacao text NOT NULL UNIQUE,
  data timestamptz,
  ano integer NOT NULL,
  descricao text,
  sigla_materia text,
  numero_materia text,
  ementa text,
  resultado text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.votacoes_senado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votacoes senado are publicly readable" ON public.votacoes_senado FOR SELECT USING (true);
CREATE POLICY "Only service role can insert votacoes senado" ON public.votacoes_senado FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update votacoes senado" ON public.votacoes_senado FOR UPDATE USING (false);

-- votos_senadores table
CREATE TABLE IF NOT EXISTS public.votos_senadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  senador_id integer NOT NULL,
  codigo_sessao_votacao text NOT NULL,
  voto text NOT NULL,
  ano integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(senador_id, codigo_sessao_votacao)
);

ALTER TABLE public.votos_senadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votos senadores are publicly readable" ON public.votos_senadores FOR SELECT USING (true);
CREATE POLICY "Only service role can insert votos senadores" ON public.votos_senadores FOR INSERT WITH CHECK (false);
