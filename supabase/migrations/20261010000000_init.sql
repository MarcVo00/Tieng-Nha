-- VietLearn initial schema. Never edit after it is applied to prod: add a new migration.
create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.paris_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;

create or replace function public.paris_week_start(d date) returns date
language sql immutable as $$ select (date_trunc('week', d::timestamp))::date $$;

-- ---------- tables ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  group_id uuid not null references public.groups,
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  avatar_emoji text not null default '🐉',
  created_at timestamptz not null default now(),
  unique (group_id, pseudo)
);

create table public.events (
  id bigint generated always as identity primary key,
  client_id uuid unique not null,
  user_id uuid not null references public.profiles on delete cascade,
  schema_version int not null default 1,
  type text not null check (type in ('lesson_completed','dialogue_completed','review_session_completed','exam_finished','badge_unlocked')),
  ref_id text not null,
  xp int not null check (xp between 0 and 100),
  payload jsonb not null default '{}',
  client_created_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index events_user_created on public.events (user_id, created_at);

create table public.user_stats (
  user_id uuid primary key references public.profiles on delete cascade,
  group_id uuid not null references public.groups,
  xp_total int not null default 0,
  xp_week int not null default 0,
  week_start date not null default public.paris_week_start(public.paris_today()),
  xp_today int not null default 0,
  today date not null default public.paris_today(),
  streak int not null default 0,
  last_active_day date,
  lessons_done text[] not null default '{}',
  dialogues_done text[] not null default '{}',
  badges text[] not null default '{}',
  exam_best int,
  updated_at timestamptz not null default now()
);
create index user_stats_group_week on public.user_stats (group_id, xp_week desc);
create index user_stats_group_total on public.user_stats (group_id, xp_total desc);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  started_at timestamptz not null default now(),
  score int check (score between 0 and 100)
);
create index exam_attempts_user_started on public.exam_attempts (user_id, started_at);

create table public.content_reports (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles on delete set null,
  ref_id text not null,
  message text not null check (char_length(message) between 1 and 500),
  content_version int,
  created_at timestamptz not null default now()
);

-- ---------- security helpers ----------
create or replace function public.my_group_id() returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from public.profiles where id = auth.uid()
$$;

-- ---------- RPC: join a group ----------
create or replace function public.join_group(p_invite_code text, p_pseudo text, p_avatar text) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into g from public.groups where invite_code = p_invite_code;
  if g is null then raise exception 'invalid_invite'; end if;
  begin
    insert into public.profiles (id, group_id, pseudo, avatar_emoji)
    values (auth.uid(), g, p_pseudo, p_avatar)
    on conflict (id) do update set pseudo = excluded.pseudo, avatar_emoji = excluded.avatar_emoji;
  exception when unique_violation then
    raise exception 'pseudo_taken';
  end;
  insert into public.user_stats (user_id, group_id) values (auth.uid(), g) on conflict (user_id) do nothing;
end $$;

-- ---------- trigger: project events into user_stats ----------
create or replace function public.apply_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.user_stats%rowtype;
  v_today date := public.paris_today();
  v_week date := public.paris_week_start(public.paris_today());
  v_day date := (least(new.client_created_at, now()) at time zone 'Europe/Paris')::date;
  v_score int := coalesce((new.payload->>'score')::int, 0);
  v_credit int;
begin
  select * into s from public.user_stats where user_id = new.user_id for update;
  if not found then return new; end if;

  if s.today <> v_today then s.xp_today := 0; s.today := v_today; end if;
  if s.week_start <> v_week then s.xp_week := 0; s.week_start := v_week; end if;

  if new.type = 'exam_finished' then
    v_credit := greatest(0, v_score - coalesce(s.exam_best, 0));  -- client xp ignored
    s.exam_best := greatest(coalesce(s.exam_best, 0), v_score);
  else
    v_credit := new.xp;
  end if;
  v_credit := least(v_credit, greatest(0, 200 - s.xp_today));
  s.xp_total := s.xp_total + v_credit;
  s.xp_week := s.xp_week + v_credit;
  s.xp_today := s.xp_today + v_credit;

  if new.type in ('lesson_completed','dialogue_completed','review_session_completed') then
    if s.last_active_day is null or v_day > s.last_active_day then
      s.streak := case when s.last_active_day = v_day - 1 then s.streak + 1 else 1 end;
      s.last_active_day := v_day;
    end if;
  end if;
  if new.type = 'lesson_completed' and not (new.ref_id = any(s.lessons_done)) then
    s.lessons_done := array_append(s.lessons_done, new.ref_id);
  end if;
  if new.type = 'dialogue_completed' and not (new.ref_id = any(s.dialogues_done)) then
    s.dialogues_done := array_append(s.dialogues_done, new.ref_id);
  end if;
  if new.type = 'badge_unlocked' and not (new.ref_id = any(s.badges)) then
    s.badges := array_append(s.badges, new.ref_id);
  end if;

  update public.user_stats set
    xp_total = s.xp_total, xp_week = s.xp_week, week_start = s.week_start, xp_today = s.xp_today, today = s.today,
    streak = s.streak, last_active_day = s.last_active_day, lessons_done = s.lessons_done,
    dialogues_done = s.dialogues_done, badges = s.badges, exam_best = s.exam_best, updated_at = now()
  where user_id = new.user_id;
  return new;
end $$;

create trigger events_apply after insert on public.events
for each row execute function public.apply_event();

-- ---------- RPC: exam attempts (3 per Paris day) ----------
create or replace function public.start_exam_attempt() returns json
language plpgsql security definer set search_path = public as $$
declare n int; a uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select count(*) into n from public.exam_attempts
  where user_id = auth.uid() and (started_at at time zone 'Europe/Paris')::date = public.paris_today();
  if n >= 3 then raise exception 'exam_limit'; end if;
  insert into public.exam_attempts (user_id) values (auth.uid()) returning id into a;
  return json_build_object('attempt_id', a, 'remaining_today', 2 - n);
end $$;

-- ---------- RPC: delete my account (cascades) ----------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- leaderboard view (RLS of underlying tables applies) ----------
create or replace view public.leaderboard with (security_invoker = true) as
select
  us.user_id, us.group_id, p.pseudo, p.avatar_emoji,
  us.xp_total,
  case when us.week_start = public.paris_week_start(public.paris_today()) then us.xp_week else 0 end as xp_week,
  case when us.last_active_day >= public.paris_today() - 1 then us.streak else 0 end as streak,
  coalesce(array_length(us.lessons_done, 1), 0) as lessons_done_count,
  us.lessons_done, us.dialogues_done, us.badges, us.exam_best
from public.user_stats us
join public.profiles p on p.id = us.user_id;

-- ---------- RLS ----------
alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.user_stats enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.content_reports enable row level security;

create policy groups_select on public.groups for select to authenticated using (id = public.my_group_id());
create policy profiles_select on public.profiles for select to authenticated using (group_id = public.my_group_id());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy events_select on public.events for select to authenticated using (user_id = auth.uid());
create policy events_insert on public.events for insert to authenticated with check (user_id = auth.uid());
create policy stats_select on public.user_stats for select to authenticated using (group_id = public.my_group_id());
create policy exam_select on public.exam_attempts for select to authenticated using (user_id = auth.uid());
create policy exam_update on public.exam_attempts for update to authenticated using (user_id = auth.uid() and score is null) with check (user_id = auth.uid());
create policy reports_insert on public.content_reports for insert to authenticated with check (user_id = auth.uid());

-- Column-level privileges: only pseudo/avatar and score are updatable by clients.
revoke update on public.profiles from anon, authenticated;
grant update (pseudo, avatar_emoji) on public.profiles to authenticated;
revoke update on public.exam_attempts from anon, authenticated;
grant update (score) on public.exam_attempts to authenticated;
revoke all on public.user_stats from anon;
revoke insert, update, delete on public.user_stats from authenticated;
revoke all on function public.delete_my_account() from anon;
revoke all on function public.start_exam_attempt() from anon;
revoke all on function public.join_group(text, text, text) from anon;
