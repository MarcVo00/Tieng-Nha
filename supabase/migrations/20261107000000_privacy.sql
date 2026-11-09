-- Privacy audit of 2026-11-05: reports leave with the account, members see only the leaderboard, deleting an account
-- asks for its password, and everyone can download their data.

-- 1. A report's free text can name someone: it is deleted with its author instead of being kept without one.
alter table public.content_reports drop constraint content_reports_user_id_fkey;
alter table public.content_reports
  add constraint content_reports_user_id_fkey foreign key (user_id) references public.profiles on delete cascade;

-- 2. The privacy contact lives here, not in the code: the repository and the bundle are public, this row is members only.
-- Members no longer read the invite code; the keep-alive workflow still reads the id as anon (it gets no row).
alter table public.groups add column privacy_contact text;
revoke select on public.groups from anon, authenticated;
grant select (id, name, created_at, privacy_contact) on public.groups to authenticated;
grant select (id) on public.groups to anon;

-- 3. A member reads their own stats and, for the others, only the leaderboard columns. The view now runs as its owner,
-- which skips the row level security of user_stats, so it filters on the group itself.
drop policy stats_select on public.user_stats;
create policy stats_select on public.user_stats for select to authenticated using (user_id = auth.uid());

create or replace view public.leaderboard with (security_invoker = false) as
select
  us.user_id, us.group_id, p.pseudo, p.avatar_emoji,
  us.xp_total,
  case when us.week_start = public.paris_week_start(public.paris_today()) then us.xp_week else 0 end as xp_week,
  case when us.last_active_day >= public.paris_today() - 1 - us.streak_freezes then us.streak else 0 end as streak,
  coalesce(array_length(us.lessons_done, 1), 0) as lessons_done_count,
  us.lessons_done, us.dialogues_done, us.badges, us.exam_best,
  us.coins, us.equipped->>'frame' as equipped_frame,
  us.equipped,
  us.exam_bests
from public.user_stats us
join public.profiles p on p.id = us.user_id
where us.group_id = public.my_group_id();

-- 4. Deleting an account needs its password, so a stolen session or an unlocked phone is not enough.
drop function public.delete_my_account();
create function public.delete_my_account(p_password text default null) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_hash text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select encrypted_password into v_hash from auth.users where id = auth.uid();
  if coalesce(v_hash, '') <> '' and (p_password is null or extensions.crypt(p_password, v_hash) <> v_hash) then
    raise exception 'wrong_password';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

-- 5. Everything stored about the caller, in one JSON document (access and portability).
create function public.export_my_data() returns json
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  return json_build_object(
    'exported_at', now(),
    'account', (select json_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at)
                from auth.users u where u.id = v_uid),
    'profile', (select row_to_json(t) from public.profiles t where t.id = v_uid),
    'stats', (select row_to_json(t) from public.user_stats t where t.user_id = v_uid),
    'events', (select coalesce(json_agg(t order by t.created_at), '[]') from public.events t where t.user_id = v_uid),
    'exam_attempts', (select coalesce(json_agg(t order by t.started_at), '[]') from public.exam_attempts t where t.user_id = v_uid),
    'gacha_pulls', (select coalesce(json_agg(t order by t.created_at), '[]') from public.gacha_pulls t where t.user_id = v_uid),
    'duel_runs', (select coalesce(json_agg(t), '[]') from public.duel_runs t where t.user_id = v_uid),
    'content_reports', (select coalesce(json_agg(t order by t.created_at), '[]') from public.content_reports t where t.user_id = v_uid)
  );
end $$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
