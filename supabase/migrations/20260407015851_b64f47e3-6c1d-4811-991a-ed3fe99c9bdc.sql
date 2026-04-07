
ALTER TABLE public.analises_deputados 
  ADD COLUMN IF NOT EXISTS is_titular boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS situacao text DEFAULT null;

ALTER TABLE public.analises_senadores 
  ADD COLUMN IF NOT EXISTS is_titular boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS descricao_participacao text DEFAULT null;
