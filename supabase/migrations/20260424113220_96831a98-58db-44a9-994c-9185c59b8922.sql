
DROP VIEW IF EXISTS public.prioridade_agregada;

CREATE VIEW public.prioridade_agregada
WITH (security_invoker = true) AS
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
