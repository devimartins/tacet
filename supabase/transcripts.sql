-- ForjaClip — cache de transcrição por vídeo, teto mensal e métricas de custo.
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem problema.
-- Depende de public.is_admin() (supabase/admin.sql).

-- 1) Cache: a transcrição de cada trecho (vídeo + início + duração) é paga uma vez só.
create table if not exists public.transcript_cache (
  video_id   text        not null,
  from_s     int         not null,
  len_s      int         not null,
  segments   jsonb       not null,
  positions  jsonb       not null default '{}'::jsonb,
  model      text,
  hits       int         not null default 0,
  created_at timestamptz not null default now(),
  last_hit   timestamptz,
  primary key (video_id, from_s, len_s)
);
alter table public.transcript_cache enable row level security;  -- sem policies: só o Worker (service role) acessa

create or replace function public.hit_transcript(p_video text, p_from int, p_len int)
returns void language sql security definer set search_path = public as $$
  update transcript_cache set hits = hits + 1, last_hit = now()
  where video_id = p_video and from_s = p_from and len_s = p_len $$;
revoke all on function public.hit_transcript(text, int, int) from public, anon, authenticated;

-- 2) Uso mensal por pessoa (segundos de vídeo transcritos de verdade, sem contar cache).
create table if not exists public.yt_monthly (
  user_id uuid not null,
  month   text not null,           -- 'YYYY-MM' (UTC)
  seconds int  not null default 0,
  primary key (user_id, month)
);
alter table public.yt_monthly enable row level security;

-- Soma p_sec ao mês se couber no teto p_cap. Aceita valor negativo (desfazer). Retorna false se estourar.
create or replace function public.add_yt_month(p_user uuid, p_month text, p_sec int, p_cap int)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok int;
begin
  if p_sec <= 0 then
    update yt_monthly set seconds = greatest(0, seconds + p_sec) where user_id = p_user and month = p_month;
    return true;
  end if;
  if p_sec > p_cap then return false; end if;
  insert into yt_monthly(user_id, month, seconds) values (p_user, p_month, p_sec)
  on conflict (user_id, month) do update set seconds = yt_monthly.seconds + excluded.seconds
    where yt_monthly.seconds + excluded.seconds <= p_cap;
  get diagnostics ok = row_count;
  return ok > 0;
end $$;
revoke all on function public.add_yt_month(uuid, text, int, int) from public, anon, authenticated;

-- 3) Registro de cada pedido (para as métricas).
create table if not exists public.yt_events (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null,
  month      text        not null,
  plan       text        not null check (plan in ('free','pro','admin')),
  seconds    int         not null,
  cached     boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists yt_events_month on public.yt_events(month, plan);
alter table public.yt_events enable row level security;

-- 4) Parâmetros editáveis (custo estimado do Gemini por hora de vídeo, em R$).
create table if not exists public.app_params (key text primary key, value numeric not null);
alter table public.app_params enable row level security;
insert into public.app_params(key, value) values ('gemini_brl_per_hour', 1.5) on conflict do nothing;

-- 5) Métricas por mês e plano. Uso: select * from yt_metrics();  (no SQL Editor ou logado como admin)
--    'pessoas' = quem usou a transcrição no mês; custo por pessoa = custo estimado ÷ pessoas.
create or replace function public.yt_metrics()
returns table(month text, plan text, pessoas bigint, horas_api numeric, horas_cache numeric,
              pct_cache numeric, custo_estimado_brl numeric, custo_por_pessoa_brl numeric)
language plpgsql security definer set search_path = public as $$
declare r numeric;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'forbidden'; end if;
  select value into r from app_params where key = 'gemini_brl_per_hour';
  return query
    select e.month, e.plan,
      count(distinct e.user_id),
      round(sum(e.seconds) filter (where not e.cached) / 3600.0, 2),
      round(sum(e.seconds) filter (where e.cached) / 3600.0, 2),
      round(100.0 * coalesce(sum(e.seconds) filter (where e.cached), 0) / nullif(sum(e.seconds), 0), 1),
      round(coalesce(sum(e.seconds) filter (where not e.cached), 0) / 3600.0 * r, 2),
      round(coalesce(sum(e.seconds) filter (where not e.cached), 0) / 3600.0 * r / nullif(count(distinct e.user_id), 0), 2)
    from yt_events e group by e.month, e.plan order by e.month desc, e.plan;
end $$;
revoke all on function public.yt_metrics() from public, anon;
grant execute on function public.yt_metrics() to authenticated;
