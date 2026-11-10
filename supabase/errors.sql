-- ForjaClip: registro automático de erros do app. Rode UMA vez no Supabase (SQL Editor), depois de admin.sql. Seguro para rodar de novo.
-- O app só grava (insert); ninguém lê pela API. O painel do criador lê pela função admin_errors, que confere is_admin().
-- Nada de vídeo, áudio ou transcrição é guardado: só a mensagem do erro, a versão do app e dados técnicos do navegador.
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  kind text not null check (char_length(kind) <= 40),
  message text not null check (char_length(message) <= 1000),
  stack text check (char_length(stack) <= 4000),
  page text check (char_length(page) <= 200),
  version text check (char_length(version) <= 40),
  ua text check (char_length(ua) <= 400),
  extra jsonb check (pg_column_size(extra) <= 8000)
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;
drop policy if exists app_errors_insert on public.app_errors;
create policy app_errors_insert on public.app_errors for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());
grant insert on public.app_errors to anon, authenticated;
revoke select, update, delete on public.app_errors from anon, authenticated;

-- Erros dos últimos `days` dias agrupados por tipo e mensagem (mais recentes primeiro). Apaga registros com mais de 30 dias.
create or replace function public.admin_errors(days int default 7, lim int default 100)
returns table (kind text, message text, total bigint, users bigint, last_at timestamptz, version text, ua text, extra jsonb, stack text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.app_errors where created_at < now() - interval '30 days';
  return query
    select e.kind, e.message, count(*), count(distinct e.user_id),
           max(e.created_at),
           (array_agg(e.version order by e.created_at desc))[1],
           (array_agg(e.ua order by e.created_at desc))[1],
           (array_agg(e.extra order by e.created_at desc))[1],
           (array_agg(e.stack order by e.created_at desc))[1]
    from public.app_errors e
    where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(days, 7), 30)))
    group by e.kind, e.message
    order by max(e.created_at) desc
    limit least(coalesce(lim, 100), 300);
end $$;
revoke all on function public.admin_errors(int, int) from public, anon;
grant execute on function public.admin_errors(int, int) to authenticated;
