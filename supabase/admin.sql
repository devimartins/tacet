-- ForjaClip: painel admin. Rode UMA vez no Supabase (SQL Editor). Seguro para rodar de novo.
create table if not exists public.admins (user_id uuid primary key references auth.users on delete cascade);
alter table public.admins enable row level security;   -- sem policies: só as funções abaixo leem

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'new7', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'pro', (select count(*) from public.profiles where plan = 'pro' or pro_until > now()),
    'projects', (select count(*) from public.projects),
    'payments', (select count(*) from public.payments),
    'revenue', (select coalesce(sum(amount), 0) from public.payments),
    'audio_today', (select coalesce(sum(amount), 0) from public.usage where day = current_date and kind = 'audio' and user_id <> '00000000-0000-0000-0000-000000000000'),
    'llm_today', (select coalesce(sum(amount), 0) from public.usage where day = current_date and kind = 'llm' and user_id <> '00000000-0000-0000-0000-000000000000')
  );
end $$;

create or replace function public.admin_users(q text default '', lim int default 50)
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, plan text, pro_until timestamptz, projects bigint, paid numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, p.plan::text, p.pro_until,
           (select count(*) from public.projects j where j.user_id = u.id),
           (select coalesce(sum(m.amount), 0)::numeric from public.payments m where m.user_id = u.id)
    from auth.users u left join public.profiles p on p.user_id = u.id
    where coalesce(q, '') = '' or u.email ilike '%' || q || '%'
    order by u.created_at desc limit least(coalesce(lim, 50), 200);
end $$;

-- days > 0 soma dias de Pro; days = 0 encerra o Pro do usuário.
create or replace function public.admin_grant(uid uuid, days int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare novo timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if days > 0 then
    select greatest(now(), coalesce((select pro_until from public.profiles where user_id = uid), now())) + days * interval '1 day' into novo;
    insert into public.profiles (user_id, pro_until) values (uid, novo)
      on conflict (user_id) do update set pro_until = excluded.pro_until;
  else
    novo := null;
    update public.profiles set pro_until = null, plan = 'free' where user_id = uid;
  end if;
  return novo;
end $$;

revoke all on function public.is_admin(), public.admin_overview(), public.admin_users(text, int), public.admin_grant(uuid, int) from public, anon;
grant execute on function public.is_admin(), public.admin_overview(), public.admin_users(text, int), public.admin_grant(uuid, int) to authenticated;

-- Você, criador: admin + Pro até 2099.
insert into public.admins (user_id) select id from auth.users where email = 'davimdmelo@gmail.com' on conflict do nothing;
insert into public.profiles (user_id, plan, pro_until) select id, 'pro', '2099-12-31' from auth.users where email = 'davimdmelo@gmail.com'
  on conflict (user_id) do update set plan = 'pro', pro_until = '2099-12-31';
