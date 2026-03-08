
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Cron job: sync Câmara every hour at minute 0
SELECT cron.schedule(
  'sync-camara-hourly',
  '0 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://pyacnmungdtsnntvtsxx.supabase.co/functions/v1/sync-camara',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5YWNubXVuZ2R0c25udHZ0c3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDU4MzksImV4cCI6MjA4NjY4MTgzOX0.njvVv9MZI3RRPsS2GY6qT-svMZuMx7Dyb3TauOTx_FY"}'::jsonb,
    body := concat('{"ano": ', extract(year from now())::int, '}')::jsonb
  ) AS request_id;
  $$
);

-- Cron job: sync Senado every hour at minute 30
SELECT cron.schedule(
  'sync-senado-hourly',
  '30 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://pyacnmungdtsnntvtsxx.supabase.co/functions/v1/sync-senado',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5YWNubXVuZ2R0c25udHZ0c3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDU4MzksImV4cCI6MjA4NjY4MTgzOX0.njvVv9MZI3RRPsS2GY6qT-svMZuMx7Dyb3TauOTx_FY"}'::jsonb,
    body := concat('{"ano": ', extract(year from now())::int, '}')::jsonb
  ) AS request_id;
  $$
);
