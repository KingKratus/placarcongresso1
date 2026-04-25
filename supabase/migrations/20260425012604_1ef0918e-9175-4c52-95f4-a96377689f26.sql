ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_name_length CHECK (char_length(name) BETWEEN 1 AND 80),
  ADD CONSTRAINT api_keys_value_length CHECK (char_length(api_key) BETWEEN 20 AND 120);

DROP POLICY IF EXISTS "Users can view own sync runs" ON public.sync_runs;
CREATE POLICY "Users can view own or admin system sync runs"
ON public.sync_runs
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (user_id IS NULL AND public.has_role('admin'))
);

DROP POLICY IF EXISTS "Users can view events of accessible runs" ON public.sync_run_events;
CREATE POLICY "Users can view own or admin system run events"
ON public.sync_run_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sync_runs sr
    WHERE sr.id = sync_run_events.run_id
      AND (
        sr.user_id = auth.uid()
        OR (sr.user_id IS NULL AND public.has_role('admin'))
      )
  )
);

DROP VIEW IF EXISTS public.prioridade_agregada;

CREATE VIEW public.prioridade_agregada AS
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
WHERE p.ativa = true
GROUP BY p.id;

GRANT SELECT ON public.prioridade_agregada TO anon, authenticated;