-- ForjaClip: registro da declaração de direitos sobre vídeos. Rode UMA vez no SQL Editor do Supabase.
create table if not exists public.rights_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null,
  video_ref text,
  start_s numeric,
  end_s numeric,
  termo text,
  ua text,
  accepted_at timestamptz not null default now()
);
alter table public.rights_log enable row level security;
drop policy if exists rights_ins on public.rights_log;
create policy rights_ins on public.rights_log for insert to authenticated with check (user_id = auth.uid());
drop policy if exists rights_sel on public.rights_log;
create policy rights_sel on public.rights_log for select to authenticated using (user_id = auth.uid());
