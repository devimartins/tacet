-- Cache das sugestões de cortes da IA (aplicado em 13/11/2026).
-- Chave = SHA-256 da transcrição + opções (duração mínima/máxima, quantidade, tema).
-- Só o Worker (service role) lê e grava; "Refazer sugestões" ignora o cache e grava o resultado novo.
create table if not exists public.clips_cache (
  key text primary key,
  clips jsonb not null,
  model text,
  created_at timestamptz not null default now()
);
alter table public.clips_cache enable row level security;
revoke all on public.clips_cache from anon, authenticated;
create index if not exists clips_cache_created on public.clips_cache (created_at);
