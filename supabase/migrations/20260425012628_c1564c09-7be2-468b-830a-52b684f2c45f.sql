DROP VIEW IF EXISTS public.prioridade_agregada;

CREATE TABLE IF NOT EXISTS public.prioridade_agregada (
  proposicao_id uuid PRIMARY KEY,
  casa text NOT NULL,
  tipo text NOT NULL,
  numero text NOT NULL,
  ano integer NOT NULL,
  titulo text NOT NULL,
  tema text NOT NULL,
  total_votos integer NOT NULL DEFAULT 0,
  prioridade_media numeric NOT NULL DEFAULT 0,
  favor integer NOT NULL DEFAULT 0,
  contra integer NOT NULL DEFAULT 0,
  neutro integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prioridade_agregada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prioridade agregada is publicly readable" ON public.prioridade_agregada;
CREATE POLICY "Prioridade agregada is publicly readable"
ON public.prioridade_agregada
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Block public writes to prioridade agregada" ON public.prioridade_agregada;
CREATE POLICY "Block public writes to prioridade agregada"
ON public.prioridade_agregada
FOR ALL
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.refresh_prioridade_agregada(_proposicao_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _proposicao_id IS NOT NULL THEN
    DELETE FROM public.prioridade_agregada
    WHERE proposicao_id = _proposicao_id
      AND NOT EXISTS (
        SELECT 1 FROM public.proposicoes_prioritarias p
        WHERE p.id = _proposicao_id AND p.ativa = true
      );

    INSERT INTO public.prioridade_agregada (
      proposicao_id, casa, tipo, numero, ano, titulo, tema,
      total_votos, prioridade_media, favor, contra, neutro, updated_at
    )
    SELECT
      p.id,
      p.casa,
      p.tipo,
      p.numero,
      p.ano,
      p.titulo,
      p.tema,
      COUNT(v.id)::int,
      COALESCE(ROUND(AVG(v.prioridade)::numeric, 2), 0),
      COUNT(v.id) FILTER (WHERE v.posicao = 'favor')::int,
      COUNT(v.id) FILTER (WHERE v.posicao = 'contra')::int,
      COUNT(v.id) FILTER (WHERE v.posicao = 'neutro')::int,
      now()
    FROM public.proposicoes_prioritarias p
    LEFT JOIN public.prioridade_votos v ON v.proposicao_id = p.id
    WHERE p.id = _proposicao_id AND p.ativa = true
    GROUP BY p.id
    ON CONFLICT (proposicao_id) DO UPDATE SET
      casa = EXCLUDED.casa,
      tipo = EXCLUDED.tipo,
      numero = EXCLUDED.numero,
      ano = EXCLUDED.ano,
      titulo = EXCLUDED.titulo,
      tema = EXCLUDED.tema,
      total_votos = EXCLUDED.total_votos,
      prioridade_media = EXCLUDED.prioridade_media,
      favor = EXCLUDED.favor,
      contra = EXCLUDED.contra,
      neutro = EXCLUDED.neutro,
      updated_at = now();
  ELSE
    DELETE FROM public.prioridade_agregada;

    INSERT INTO public.prioridade_agregada (
      proposicao_id, casa, tipo, numero, ano, titulo, tema,
      total_votos, prioridade_media, favor, contra, neutro, updated_at
    )
    SELECT
      p.id,
      p.casa,
      p.tipo,
      p.numero,
      p.ano,
      p.titulo,
      p.tema,
      COUNT(v.id)::int,
      COALESCE(ROUND(AVG(v.prioridade)::numeric, 2), 0),
      COUNT(v.id) FILTER (WHERE v.posicao = 'favor')::int,
      COUNT(v.id) FILTER (WHERE v.posicao = 'contra')::int,
      COUNT(v.id) FILTER (WHERE v.posicao = 'neutro')::int,
      now()
    FROM public.proposicoes_prioritarias p
    LEFT JOIN public.prioridade_votos v ON v.proposicao_id = p.id
    WHERE p.ativa = true
    GROUP BY p.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_prioridade_agregada_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'prioridade_votos' THEN
    PERFORM public.refresh_prioridade_agregada(COALESCE(NEW.proposicao_id, OLD.proposicao_id));
  ELSE
    PERFORM public.refresh_prioridade_agregada(COALESCE(NEW.id, OLD.id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refresh_prioridade_votos_agregada ON public.prioridade_votos;
CREATE TRIGGER refresh_prioridade_votos_agregada
AFTER INSERT OR UPDATE OR DELETE ON public.prioridade_votos
FOR EACH ROW EXECUTE FUNCTION public.refresh_prioridade_agregada_trigger();

DROP TRIGGER IF EXISTS refresh_prioritarias_agregada ON public.proposicoes_prioritarias;
CREATE TRIGGER refresh_prioritarias_agregada
AFTER INSERT OR UPDATE OR DELETE ON public.proposicoes_prioritarias
FOR EACH ROW EXECUTE FUNCTION public.refresh_prioridade_agregada_trigger();

SELECT public.refresh_prioridade_agregada(NULL);