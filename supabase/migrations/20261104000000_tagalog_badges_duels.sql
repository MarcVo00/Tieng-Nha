set lock_timeout = '10s';

-- Tagalog badges and duels per language (Tagalog spec 2026-11-02 §4.5, §4.6). Never edit after it is applied to prod:
-- add a new migration. The badge amounts live here AND in src/content/badges.json (parity: src/content/shopParity.test.ts).

-- 1. xu paid by the first unlock of a badge: the 24 badges of 20261030000000_badge_rewards.sql plus the 9 Tagalog ones.
create or replace function public.badge_coins(p_badge text) returns int
language sql immutable set search_path = '' as $$
  select coalesce((select v.coins from (values
    ('first_lesson', 20),
    ('three_lessons', 30),
    ('five_lessons', 40),
    ('ten_lessons', 100),
    ('streak_3', 30),
    ('streak_7', 60),
    ('streak_14', 100),
    ('streak_30', 200),
    ('perfect_lesson', 20),
    ('perfect_5', 60),
    ('perfect_10', 120),
    ('vocab_25', 20),
    ('vocab_100', 50),
    ('vocab_250', 100),
    ('first_dialogue', 20),
    ('five_dialogues', 50),
    ('all_dialogues', 100),
    ('exam_passed', 100),
    ('exam_excellent', 150),
    ('xp_500', 40),
    ('xp_1500', 100),
    ('xp_3000', 200),
    ('days_10', 60),
    ('days_30', 150),
    ('tl_first_lesson', 20),
    ('tl_four_lessons', 40),
    ('tl_all_lessons', 100),
    ('tl_perfect_lesson', 20),
    ('tl_perfect_all', 120),
    ('tl_first_dialogue', 20),
    ('tl_all_dialogues', 100),
    ('tl_exam_passed', 100),
    ('tl_exam_excellent', 150)
  ) as v(badge, coins) where v.badge = p_badge), 0)
$$;
revoke execute on function public.badge_coins(text) from public, anon, authenticated;

-- 2. The language of a content id, like languageOfId in src/domain/languages.ts: `tl_…` is Tagalog, the rest Vietnamese.
create function public.language_of_id(p_id text) returns text
language sql immutable set search_path = '' as $$
  select case when left(p_id, 3) = 'tl_' then 'tl' else 'vi' end
$$;
revoke execute on function public.language_of_id(text) from public, anon, authenticated;

-- 3. A duel carries its language; the duels from before are Vietnamese.
alter table public.duels add column language text not null default 'vi' check (language in ('vi', 'tl'));

-- 4. create_duel per language: same body as 20261022000000_duels.sql, except that
--    - both players need the first lesson and the first dialogue OF THE LANGUAGE;
--    - the questions come from lessons of that language done by both;
--    - one open duel per pair AND per language (the 5 new duels a day stay shared).
-- Called without p_language (apps before 2.2) it creates a Vietnamese duel, as before.
drop function public.create_duel(uuid, jsonb, int);
create function public.create_duel(p_opponent uuid, p_questions jsonb, p_seed int, p_language text default 'vi') returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_group uuid;
  v_their_group uuid;
  v_mine public.user_stats%rowtype;
  v_theirs public.user_stats%rowtype;
  v_common text[];
  v_r1 jsonb;
  v_r2 jsonb;
  v_clean jsonb;
  v_id uuid;
  v_prefix text;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_opponent is null then return json_build_object('ok', false, 'error', 'not_same_group'); end if;
  if p_opponent = v_me then return json_build_object('ok', false, 'error', 'self'); end if;
  if p_language is null or p_language not in ('vi', 'tl') then return json_build_object('ok', false, 'error', 'bad_questions'); end if;
  v_prefix := case when p_language = 'vi' then '' else p_language || '_' end;

  -- serialise this player's creations (daily quota) and each pair (one open duel per pair)
  perform pg_advisory_xact_lock(hashtextextended('duel:' || v_me::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    'duelpair:' || least(v_me, p_opponent)::text || greatest(v_me, p_opponent)::text, 0));

  select group_id into v_group from public.profiles where id = v_me;
  select group_id into v_their_group from public.profiles where id = p_opponent;
  if v_group is null or v_their_group is distinct from v_group then
    return json_build_object('ok', false, 'error', 'not_same_group');
  end if;

  -- a stale duel never blocks a new challenge
  perform public.expire_duels(v_me);

  select * into v_mine from public.user_stats where user_id = v_me;
  select * into v_theirs from public.user_stats where user_id = p_opponent;
  if not found or v_mine.user_id is null
     or not ((v_prefix || 'l01') = any(v_mine.lessons_done) and (v_prefix || 'd01') = any(v_mine.dialogues_done))
     or not ((v_prefix || 'l01') = any(v_theirs.lessons_done) and (v_prefix || 'd01') = any(v_theirs.dialogues_done)) then
    return json_build_object('ok', false, 'error', 'prerequisites');
  end if;

  select coalesce(array_agg(x), '{}') into v_common
  from unnest(v_mine.lessons_done) x where x = any(v_theirs.lessons_done) and public.language_of_id(x) = p_language;

  -- shape: { round1: 4..8 refs, round2: 1..3 refs }, each ref { lessonId, exerciseId } (strings)
  if p_seed is null or jsonb_typeof(p_questions) is distinct from 'object' then
    return json_build_object('ok', false, 'error', 'bad_questions');
  end if;
  v_r1 := p_questions->'round1';
  v_r2 := p_questions->'round2';
  if jsonb_typeof(v_r1) is distinct from 'array' or jsonb_typeof(v_r2) is distinct from 'array'
     or jsonb_array_length(v_r1) not between 4 and 8 or jsonb_array_length(v_r2) not between 1 and 3
     or exists (
       select 1 from (select e from jsonb_array_elements(v_r1) e union all select e from jsonb_array_elements(v_r2) e) q
       where jsonb_typeof(q.e) is distinct from 'object'
          or jsonb_typeof(q.e->'lessonId') is distinct from 'string'
          or jsonb_typeof(q.e->'exerciseId') is distinct from 'string'
          or char_length(q.e->>'lessonId') not between 1 and 64
          or char_length(q.e->>'exerciseId') not between 1 and 64) then
    return json_build_object('ok', false, 'error', 'bad_questions');
  end if;

  if exists (
    select 1 from (select e from jsonb_array_elements(v_r1) e union all select e from jsonb_array_elements(v_r2) e) q
    where not ((q.e->>'lessonId') = any(v_common))) then
    return json_build_object('ok', false, 'error', 'not_common_lesson');
  end if;

  if exists (
    select 1 from public.duels
    where status = 'open' and language = p_language
      and ((challenger = v_me and opponent = p_opponent) or (challenger = p_opponent and opponent = v_me))) then
    return json_build_object('ok', false, 'error', 'already_open');
  end if;

  if (select count(*) from public.duels
      where challenger = v_me and (created_at at time zone 'Europe/Paris')::date = public.paris_today()) >= 5 then
    return json_build_object('ok', false, 'error', 'daily_limit');
  end if;

  -- store only the validated fields, in order
  v_clean := jsonb_build_object(
    'round1', (select jsonb_agg(jsonb_build_object('lessonId', e->>'lessonId', 'exerciseId', e->>'exerciseId'))
               from jsonb_array_elements(v_r1) e),
    'round2', (select jsonb_agg(jsonb_build_object('lessonId', e->>'lessonId', 'exerciseId', e->>'exerciseId'))
               from jsonb_array_elements(v_r2) e));

  insert into public.duels (group_id, challenger, opponent, questions, seed, expires_at, language)
  values (v_group, v_me, p_opponent, v_clean, p_seed, now() + interval '72 hours', p_language)
  returning id into v_id;
  return json_build_object('ok', true, 'duelId', v_id);
end $$;
revoke execute on function public.create_duel(uuid, jsonb, int, text) from public, anon;
grant execute on function public.create_duel(uuid, jsonb, int, text) to authenticated;
