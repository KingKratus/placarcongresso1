ALTER TABLE public.emendas_parlamentares_cache
ADD COLUMN IF NOT EXISTS cache_key text;

UPDATE public.emendas_parlamentares_cache
SET cache_key = md5(
  parlamentar_id::text || '|' || casa || '|' || tipo || '|' || numero || '|' || ano::text || '|' ||
  COALESCE(proposicao_tipo, '') || '|' || COALESCE(proposicao_numero, '') || '|' || COALESCE(proposicao_ano::text, '')
)
WHERE cache_key IS NULL;

ALTER TABLE public.emendas_parlamentares_cache
ALTER COLUMN cache_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS emendas_cache_key_idx ON public.emendas_parlamentares_cache (cache_key);