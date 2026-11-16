-- ForjaClip: indicação de amigos (7 dias de Pro quando o amigo assina) e avaliações com aprovação do criador.
-- Rode UMA vez no Supabase (SQL Editor), depois de admin.sql e promo.sql. Seguro para rodar de novo.
create table if not exists public.ref_codes (user_id uuid primary key references auth.users on delete cascade, code text not null unique, created_at timestamptz not null default now());
create table if not exists public.referrals (
  invitee uuid primary key references auth.users on delete cascade, referrer uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(), rewarded_at timestamptz, check (invitee <> referrer)
);
create index if not exists referrals_referrer on public.referrals (referrer);
create table if not exists public.reviews (
  user_id uuid primary key references auth.users on delete cascade, stars int not null check (stars between 1 and 5),
  body text not null default '' check (char_length(body) <= 600), name text not null default '' check (char_length(name) <= 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), decided_at timestamptz
);
alter table public.ref_codes enable row level security; alter table public.referrals enable row level security; alter table public.reviews enable row level security;   -- sem policies: só as funções leem

-- ---------- indicação ----------
-- meu código e meus números (cria o código na primeira vez)
create or replace function public.ref_mine() returns jsonb language plpgsql security definer set search_path = public as $$
declare c text; n int; r int;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select code into c from public.ref_codes where user_id = auth.uid();
  while c is null loop
    begin
      insert into public.ref_codes (user_id, code) values (auth.uid(), substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 7)) returning code into c;
    exception when unique_violation then c := null; end;
  end loop;
  select count(*), count(rewarded_at) into n, r from public.referrals where referrer = auth.uid();
  return jsonb_build_object('code', c, 'invited', n, 'rewarded', r, 'days', r * 7);
end $$;

-- conta nova informa por qual código chegou. Só vale para conta criada há até 7 dias, sem pagamento e ainda sem indicação.
create or replace function public.ref_claim(c text) returns boolean language plpgsql security definer set search_path = public, auth as $$
declare ref uuid;
begin
  if auth.uid() is null then return false; end if;
  select user_id into ref from public.ref_codes where code = lower(trim(coalesce(c, '')));
  if ref is null or ref = auth.uid() then return false; end if;
  if not exists (select 1 from auth.users where id = auth.uid() and created_at > now() - interval '7 days') then return false; end if;
  if exists (select 1 from public.payments where user_id = auth.uid()) then return false; end if;
  insert into public.referrals (invitee, referrer) values (auth.uid(), ref) on conflict (invitee) do nothing;
  return found;
end $$;

-- chamado pelo servidor (Worker) quando um pagamento é aprovado: no PRIMEIRO pagamento do amigo, quem indicou ganha 7 dias. Teto de 24 prêmios por pessoa a cada 365 dias.
create or replace function public.ref_reward(uid uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare r public.referrals;
begin
  select * into r from public.referrals where invitee = uid and rewarded_at is null for update;
  if not found then return false; end if;
  if (select count(*) from public.payments where user_id = uid and refunded_at is null) <> 1 then return false; end if;
  if (select count(*) from public.referrals where referrer = r.referrer and rewarded_at > now() - interval '365 days') >= 24 then return false; end if;
  perform public._add_pro(r.referrer, 7);
  update public.referrals set rewarded_at = now() where invitee = uid;
  return true;
end $$;

-- chamado pelo servidor quando o pagamento do amigo é reembolsado: devolve os 7 dias (sem deixar o fim do Pro no passado distante)
create or replace function public.ref_unreward(uid uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare r public.referrals;
begin
  select * into r from public.referrals where invitee = uid and rewarded_at is not null for update;
  if not found then return false; end if;
  if exists (select 1 from public.payments where user_id = uid and refunded_at is null) then return false; end if;
  update public.profiles set pro_until = greatest(now(), pro_until - interval '7 days') where user_id = r.referrer and pro_until > now();
  update public.referrals set rewarded_at = null where invitee = uid;
  return true;
end $$;
revoke all on function public.ref_reward(uuid), public.ref_unreward(uuid) from public, anon, authenticated;
grant execute on function public.ref_reward(uuid), public.ref_unreward(uuid) to service_role;
revoke all on function public.ref_mine(), public.ref_claim(text) from public, anon; grant execute on function public.ref_mine(), public.ref_claim(text) to authenticated;

-- ---------- avaliações ----------
-- quem pode avaliar: conta com pelo menos um projeto. Editar a avaliação volta para a fila de aprovação.
create or replace function public.review_save(s int, b text, n text) returns jsonb language plpgsql security definer set search_path = public as $$
declare bb text := trim(regexp_replace(coalesce(b, ''), '\s+', ' ', 'g')); nn text := trim(regexp_replace(coalesce(n, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then raise exception 'Faça login para avaliar.'; end if;
  if s is null or s < 1 or s > 5 then raise exception 'Escolha de 1 a 5 estrelas.'; end if;
  if char_length(bb) > 600 then raise exception 'O comentário pode ter até 600 caracteres.'; end if;
  if char_length(nn) > 40 then raise exception 'O nome pode ter até 40 caracteres.'; end if;
  if not exists (select 1 from public.projects where user_id = auth.uid()) and not exists (select 1 from public.payments where user_id = auth.uid()) then raise exception 'Use o ForjaClip em um vídeo antes de avaliar.'; end if;
  insert into public.reviews (user_id, stars, body, name) values (auth.uid(), s, bb, nn)
    on conflict (user_id) do update set stars = excluded.stars, body = excluded.body, name = excluded.name, status = 'pending', updated_at = now(), decided_at = null;
  return jsonb_build_object('status', 'pending');
end $$;
create or replace function public.review_mine() returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce((select jsonb_build_object('stars', stars, 'body', body, 'name', name, 'status', status) from public.reviews where user_id = auth.uid()), 'null'::jsonb)
$$;
-- público: só as aprovadas. A média e o total contam todas as aprovadas; a lista traz as que têm comentário.
create or replace function public.reviews_public(lim int default 12) returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'count', (select count(*) from public.reviews where status = 'approved'),
    'avg', (select round(avg(stars)::numeric, 1) from public.reviews where status = 'approved'),
    'items', coalesce((select jsonb_agg(x) from (select stars, body, case when name = '' then 'Usuário do ForjaClip' else name end as name, to_char(created_at, 'YYYY-MM-DD') as date
      from public.reviews where status = 'approved' and body <> '' order by decided_at desc nulls last limit least(greatest(lim, 1), 30)) x), '[]'::jsonb))
$$;
create or replace function public.admin_reviews(st text default 'pending') returns table (user_id uuid, email text, stars int, body text, name text, status text, updated_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  return query select r.user_id, u.email::text, r.stars, r.body, r.name, r.status, r.updated_at from public.reviews r join auth.users u on u.id = r.user_id where r.status = st order by r.updated_at desc limit 200;
end $$;
create or replace function public.admin_review_set(uid uuid, st text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  if st not in ('approved', 'rejected', 'pending') then raise exception 'Estado inválido.'; end if;
  update public.reviews set status = st, decided_at = now() where user_id = uid;
end $$;
create or replace function public.admin_refs() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  return jsonb_build_object('invited', (select count(*) from public.referrals), 'rewarded', (select count(*) from public.referrals where rewarded_at is not null));
end $$;
revoke all on function public.review_save(int, text, text), public.review_mine(), public.admin_reviews(text), public.admin_review_set(uuid, text), public.admin_refs() from public, anon;
grant execute on function public.review_save(int, text, text), public.review_mine(), public.admin_reviews(text), public.admin_review_set(uuid, text), public.admin_refs() to authenticated;
grant execute on function public.reviews_public(int) to anon, authenticated;
