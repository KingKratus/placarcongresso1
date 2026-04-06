
CREATE OR REPLACE FUNCTION public.get_monthly_alignment(p_ano integer)
RETURNS TABLE(mes integer, casa text, alinhados bigint, total bigint, score numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Câmara: compare each deputy vote with government orientation
  SELECT 
    EXTRACT(MONTH FROM v.data)::integer as mes,
    'camara'::text as casa,
    COUNT(*) FILTER (WHERE vd.voto = o.orientacao_voto) as alinhados,
    COUNT(*) as total,
    ROUND(COUNT(*) FILTER (WHERE vd.voto = o.orientacao_voto)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as score
  FROM votos_deputados vd
  JOIN votacoes v ON v.id_votacao = vd.id_votacao AND v.ano = p_ano
  JOIN orientacoes o ON o.id_votacao = v.id_votacao AND o.sigla_orgao_politico = 'Governo'
  WHERE vd.ano = p_ano AND v.data IS NOT NULL
  GROUP BY EXTRACT(MONTH FROM v.data)

  UNION ALL

  -- Senado: use analises_senadores scores aggregated by vote date
  SELECT 
    EXTRACT(MONTH FROM vs2.data)::integer as mes,
    'senado'::text as casa,
    SUM(CASE WHEN vsn.voto = 'Sim' THEN 1 ELSE 0 END)::bigint as alinhados,
    COUNT(*)::bigint as total,
    ROUND(SUM(CASE WHEN vsn.voto = 'Sim' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as score
  FROM votos_senadores vsn
  JOIN votacoes_senado vs2 ON vs2.codigo_sessao_votacao = vsn.codigo_sessao_votacao AND vs2.ano = p_ano
  WHERE vsn.ano = p_ano AND vs2.data IS NOT NULL
  GROUP BY EXTRACT(MONTH FROM vs2.data)

  ORDER BY mes, casa
$$;
