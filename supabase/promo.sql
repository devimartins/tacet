-- ForjaClip: códigos promocionais e concessão de Pro em lote. Rode UMA vez no Supabase (SQL Editor), depois de admin.sql. Seguro para rodar de novo.
create table if not exists public.promo_codes (
  code text primary key, days int not null check (days between 1 and 3660), max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0, expires_at timestamptz, note text, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.promo_redemptions (
  code text not null references public.promo_codes(code) on delete cascade, user_id uuid not null references auth.users on delete cascade,
  redeemed_at timestamptz not null default now(), primary key (code, user_id)
);
create table if not exists public.pro_invites (email text primary key, days int not null check (days > 0), note text, created_at timestamptz not null default now());
alter table public.promo_codes enable row level security; alter table public.promo_redemptions enable row level security; alter table public.pro_invites enable row level security;   -- sem policies: só as funções leem

-- soma dias de Pro ao usuário (interno)
create or replace function public._add_pro(uid uuid, d int) returns timestamptz language plpgsql security definer set search_path = public as $$
declare novo timestamptz;
begin
  select greatest(now(), coalesce((select pro_until from public.profiles where user_id = uid), now())) + d * interval '1 day' into novo;
  insert into public.profiles (user_id, pro_until) values (uid, novo) on conflict (user_id) do update set pro_until = excluded.pro_until;
  return novo;
end $$;

-- usuário resgata um código: devolve o novo fim do Pro
create or replace function public.redeem_code(c text) returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.promo_codes; novo timestamptz; code_n text := upper(trim(coalesce(c, '')));
begin
  if auth.uid() is null then raise exception 'Faça login para usar o código.'; end if;
  select * into k from public.promo_codes where code = code_n for update;
  if not found or not k.active then raise exception 'Código inválido.'; end if;
  if k.expires_at is not null and k.expires_at < now() then raise exception 'Este código expirou.'; end if;
  if k.max_uses is not null and k.uses >= k.max_uses then raise exception 'Este código já atingiu o limite de usos.'; end if;
  if exists (select 1 from public.promo_redemptions where code = code_n and user_id = auth.uid()) then raise exception 'Você já usou este código.'; end if;
  insert into public.promo_redemptions (code, user_id) values (code_n, auth.uid());
  update public.promo_codes set uses = uses + 1 where code = code_n;
  novo := public._add_pro(auth.uid(), k.days);
  return jsonb_build_object('days', k.days, 'pro_until', novo);
end $$;

-- convites por e-mail (para quem ainda não tem conta): aplicados no primeiro login
create or replace function public.claim_invites() returns int language plpgsql security definer set search_path = public as $$
declare em text; d int;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into em from auth.users where id = auth.uid();
  delete from public.pro_invites where email = em returning days into d;
  if d is null then return 0; end if;
  perform public._add_pro(auth.uid(), d); return d;
end $$;

-- admin: cria/atualiza código
create or replace function public.admin_promo_save(c text, d int, mx int default null, exp timestamptz default null, n text default null, act boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.promo_codes (code, days, max_uses, expires_at, note, active) values (upper(trim(c)), d, mx, exp, n, act)
  on conflict (code) do update set days = excluded.days, max_uses = excluded.max_uses, expires_at = excluded.expires_at, note = excluded.note, active = excluded.active;
end $$;
create or replace function public.admin_promo_list() returns setof public.promo_codes language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from public.promo_codes order by created_at desc limit 200;
end $$;

-- admin: concede Pro a vários e-mails; quem ainda não tem conta recebe um convite aplicado no primeiro login
create or replace function public.admin_grant_bulk(emails text[], d int) returns table (email text, status text)
language plpgsql security definer set search_path = public as $$
declare e text; uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if d < 1 or d > 3660 then raise exception 'dias inválidos'; end if;
  foreach e in array emails loop
    e := lower(trim(e)); if e = '' or position('@' in e) = 0 then continue; end if;
    select id into uid from auth.users where lower(auth.users.email) = e limit 1;
    if uid is not null then perform public._add_pro(uid, d); email := e; status := 'liberado agora'; return next;
    else insert into public.pro_invites (email, days) values (e, d) on conflict (email) do update set days = excluded.days; email := e; status := 'convite criado (vale no primeiro login)'; return next; end if;
  end loop;
end $$;

revoke all on function public._add_pro(uuid, int), public.redeem_code(text), public.claim_invites(), public.admin_promo_save(text, int, int, timestamptz, text, boolean), public.admin_promo_list(), public.admin_grant_bulk(text[], int) from public, anon;
grant execute on function public.redeem_code(text), public.claim_invites() to authenticated;
grant execute on function public.admin_promo_save(text, int, int, timestamptz, text, boolean), public.admin_promo_list(), public.admin_grant_bulk(text[], int) to authenticated;
