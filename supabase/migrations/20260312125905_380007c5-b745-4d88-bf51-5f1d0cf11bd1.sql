
-- Create sync_runs table for tracking sync progress
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  casa text NOT NULL,
  ano integer NOT NULL DEFAULT extract(year from now())::integer,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text,
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_runs_user_casa ON public.sync_runs(user_id, casa);
CREATE INDEX idx_sync_runs_status ON public.sync_runs(status);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync runs" ON public.sync_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Block public writes to sync_runs" ON public.sync_runs
  FOR ALL TO public USING (false) WITH CHECK (false);

-- Create sync_run_events table for real-time log streaming
CREATE TABLE IF NOT EXISTS public.sync_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.sync_runs(id) ON DELETE CASCADE,
  step text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_run_events_run ON public.sync_run_events(run_id, created_at);

ALTER TABLE public.sync_run_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events of accessible runs" ON public.sync_run_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sync_runs WHERE id = run_id AND (user_id = auth.uid() OR user_id IS NULL))
  );

CREATE POLICY "Block public writes to sync_run_events" ON public.sync_run_events
  FOR ALL TO public USING (false) WITH CHECK (false);

-- Enable realtime for sync events
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_run_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_runs;
