set lock_timeout = '10s';

-- Asynchronous duels, Kim bai (arena currency) and the catalogue `currency` column
-- (duels spec 2026-10-19 §2-4, §6-8). Never edit after it is applied to prod: add a new migration.
-- Business rules live here AND in pure TS services (src/services); the cases are mirrored in tests.

-- 1. New synced event type.
alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'lesson_completed','dialogue_completed','review_session_completed','exam_finished','badge_unlocked',
  'item_purchased','item_equipped','duel_settled'));

-- 2. Wallet column.
alter table public.user_stats add column kim_bai int not null default 0;

-- 3. Tables. Reads and writes only go through the RPCs (RLS on, no policy).
create table public.duels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups,
  challenger uuid not null references public.profiles on delete cascade,
  opponent uuid not null references public.profiles on delete cascade,
  questions jsonb not null,
  seed int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open','settled','cancelled')),
  winner uuid references public.profiles on delete set null,
  settled_at timestamptz,
  check (challenger <> opponent)
);
create index duels_challenger_created on public.duels (challenger, created_at);
create index duels_opponent_created on public.duels (opponent, created_at);
create index duels_open_expiry on public.duels (expires_at) where status = 'open';

create table public.duel_runs (
  duel_id uuid not null references public.duels on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  round1 jsonb not null,
  round2 jsonb not null,
  damage int not null,
  time_ms int not null,
  submitted_at timestamptz not null default now(),
  reward int,
  claimed boolean not null default false,
  primary key (duel_id, user_id)
);

alter table public.duels enable row level security;
alter table public.duel_runs enable row level security;
-- RPC-only tables: no direct access at all (TRUNCATE and REFERENCES ignore RLS).
revoke all on public.duels, public.duel_runs from anon, authenticated;

-- 4. Catalogue with currency (must match src/content/shop.json). The return type changes: drop + recreate.
drop function public.shop_item(text);
create function public.shop_item(p_id text) returns table(price int, kind text, slot text, currency text)
language sql immutable set search_path = '' as $$
  select v.price, v.kind, v.slot, v.currency from (values
    ('energy_refill', 30, 'consumable', null::text, 'xu'),
    ('streak_freeze', 50, 'consumable', null::text, 'xu'),
    ('frame_bronze', null::int, 'cosmetic', 'frame', 'xu'),
    ('frame_jade', null::int, 'cosmetic', 'frame', 'xu'),
    ('frame_son_mai', null::int, 'cosmetic', 'frame', 'xu'),
    ('fx_ink', null::int, 'cosmetic', 'profile_fx', 'xu'),
    ('fx_lightning', null::int, 'cosmetic', 'profile_fx', 'xu'),
    ('fx_embers', null::int, 'cosmetic', 'profile_fx', 'xu'),
    ('hat_thuy_tinh', 60, 'cosmetic', 'hat', 'xu'),
    ('aura_waves', 80, 'cosmetic', 'aura', 'xu'),
    ('outfit_son_tinh', 90, 'cosmetic', 'outfit', 'xu'),
    ('acc_thuan_thien', 120, 'cosmetic', 'accessory', 'xu'),
    ('char_kiem_khach', 200, 'cosmetic', 'character', 'xu'),
    ('char_phap_su', 200, 'cosmetic', 'character', 'xu'),
    ('hat_tay_son', 6, 'cosmetic', 'hat', 'kim_bai'),
    ('acc_con_vo', 8, 'cosmetic', 'accessory', 'kim_bai'),
    ('outfit_hoi_vat', 10, 'cosmetic', 'outfit', 'kim_bai')
  ) as v(id, price, kind, slot, currency) where v.id = p_id
$$;
revoke execute on function public.shop_item(text) from public, anon, authenticated;

-- 5. Pure scoring rules (spec §4). Inputs are validated by submit_duel_run.
-- Round 1 hit 10; critical 15 when correct and 300 <= ms < 3000; ms > 20000 is a miss. Round 2 hit 15.
create function public.duel_damage(p_round1 jsonb, p_round2 jsonb) returns int
language sql immutable set search_path = '' as $$
  select (
    coalesce((
      select sum(case
        when e->>'correct' is distinct from 'true' then 0
        when (e->>'ms')::numeric > 20000 then 0
        when (e->>'ms')::numeric >= 300 and (e->>'ms')::numeric < 3000 then 15
        else 10 end)
      from jsonb_array_elements(case when jsonb_typeof(p_round1) = 'array' then p_round1 else '[]'::jsonb end) e
    ), 0)
    + coalesce((
      select sum(case when e->>'correct' = 'true' then 15 else 0 end)
      from jsonb_array_elements(case when jsonb_typeof(p_round2) = 'array' then p_round2 else '[]'::jsonb end) e
    ), 0)
  )::int
$$;

-- Round-1 time: sum of ms, each capped at 20000.
create function public.duel_time(p_round1 jsonb) returns int
language sql immutable set search_path = '' as $$
  select coalesce(sum(least((e->>'ms')::numeric, 20000)), 0)::int
  from jsonb_array_elements(case when jsonb_typeof(p_round1) = 'array' then p_round1 else '[]'::jsonb end) e
$$;

-- 6. Settlement. Locks the duel row, so concurrent callers settle exactly once.
-- Two runs: winner by damage, then lower time, else draw (rewards 3/1, 2/2).
-- Expired with one run: forfeit (3 for the player, none for the absentee). Expired with none: cancelled.
create function public.settle_duel(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.duels%rowtype;
  runs public.duel_runs[];
  a public.duel_runs;
  b public.duel_runs;
  n int;
begin
  select * into d from public.duels where id = p_duel for update;
  if not found or d.status <> 'open' then return; end if;

  select array_agg(r order by r.user_id) into runs from public.duel_runs r where r.duel_id = p_duel;
  n := coalesce(array_length(runs, 1), 0);

  if n = 2 then
    a := runs[1];
    b := runs[2];
    if a.damage > b.damage or (a.damage = b.damage and a.time_ms < b.time_ms) then
      update public.duels set status = 'settled', winner = a.user_id, settled_at = now() where id = p_duel;
      update public.duel_runs set reward = 3 where duel_id = p_duel and user_id = a.user_id;
      update public.duel_runs set reward = 1 where duel_id = p_duel and user_id = b.user_id;
    elsif b.damage > a.damage or (a.damage = b.damage and b.time_ms < a.time_ms) then
      update public.duels set status = 'settled', winner = b.user_id, settled_at = now() where id = p_duel;
      update public.duel_runs set reward = 3 where duel_id = p_duel and user_id = b.user_id;
      update public.duel_runs set reward = 1 where duel_id = p_duel and user_id = a.user_id;
    else
      update public.duels set status = 'settled', winner = null, settled_at = now() where id = p_duel;
      update public.duel_runs set reward = 2 where duel_id = p_duel;
    end if;
  elsif d.expires_at <= now() then
    if n = 1 then
      a := runs[1];
      update public.duels set status = 'settled', winner = a.user_id, settled_at = now() where id = p_duel;
      update public.duel_runs set reward = 3 where duel_id = p_duel and user_id = a.user_id;
    else
      update public.duels set status = 'cancelled', winner = null, settled_at = now() where id = p_duel;
    end if;
  end if;
end $$;

-- Settles every expired open duel of one player.
create function public.expire_duels(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id from public.duels
    where status = 'open' and expires_at <= now() and (challenger = p_user or opponent = p_user)
    order by id
  loop
    perform public.settle_duel(r.id);
  end loop;
end $$;

revoke execute on function public.duel_damage(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.duel_time(jsonb) from public, anon, authenticated;
revoke execute on function public.settle_duel(uuid) from public, anon, authenticated;
revoke execute on function public.expire_duels(uuid) from public, anon, authenticated;

-- 7. RPC: create a duel. Business refusals return { ok: false, error }.
create function public.create_duel(p_opponent uuid, p_questions jsonb, p_seed int) returns json
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
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_opponent is null then return json_build_object('ok', false, 'error', 'not_same_group'); end if;
  if p_opponent = v_me then return json_build_object('ok', false, 'error', 'self'); end if;

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
     or not ('l01' = any(v_mine.lessons_done) and 'd01' = any(v_mine.dialogues_done))
     or not ('l01' = any(v_theirs.lessons_done) and 'd01' = any(v_theirs.dialogues_done)) then
    return json_build_object('ok', false, 'error', 'prerequisites');
  end if;

  select coalesce(array_agg(x), '{}') into v_common
  from unnest(v_mine.lessons_done) x where x = any(v_theirs.lessons_done);

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
    where status = 'open'
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

  insert into public.duels (group_id, challenger, opponent, questions, seed, expires_at)
  values (v_group, v_me, p_opponent, v_clean, p_seed, now() + interval '72 hours')
  returning id into v_id;
  return json_build_object('ok', true, 'duelId', v_id);
end $$;

-- 8. RPC: submit my run. The server recomputes damage and time; a second run settles the duel.
create function public.submit_duel_run(p_duel uuid, p_round1 jsonb, p_round2 jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  d public.duels%rowtype;
  v_status text;
  v_r1 jsonb;
  v_r2 jsonb;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_duel is null then return json_build_object('ok', false, 'error', 'not_found'); end if;

  select * into d from public.duels where id = p_duel for update;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v_me not in (d.challenger, d.opponent) then
    return json_build_object('ok', false, 'error', 'not_participant');
  end if;

  perform public.settle_duel(p_duel); -- expiry
  select status into v_status from public.duels where id = p_duel;
  if v_status <> 'open' then return json_build_object('ok', false, 'error', 'not_open'); end if;

  if exists (select 1 from public.duel_runs where duel_id = p_duel and user_id = v_me) then
    return json_build_object('ok', false, 'error', 'already_submitted');
  end if;

  if jsonb_typeof(p_round1) is distinct from 'array' or jsonb_typeof(p_round2) is distinct from 'array'
     or jsonb_array_length(p_round1) <> jsonb_array_length(d.questions->'round1')
     or jsonb_array_length(p_round2) <> jsonb_array_length(d.questions->'round2')
     or exists (
       select 1 from jsonb_array_elements(p_round1) e
       where jsonb_typeof(e) is distinct from 'object'
          or jsonb_typeof(e->'correct') is distinct from 'boolean'
          or jsonb_typeof(e->'ms') is distinct from 'number'
          or (e->>'ms') !~ '^[0-9]{1,9}$')
     or exists (
       select 1 from jsonb_array_elements(p_round2) e
       where jsonb_typeof(e) is distinct from 'object'
          or jsonb_typeof(e->'correct') is distinct from 'boolean') then
    return json_build_object('ok', false, 'error', 'bad_run');
  end if;

  -- Store sanitized arrays only ({correct, ms} / {correct}); extra keys sent by the client are dropped.
  select coalesce(jsonb_agg(jsonb_build_object('correct', (e.v->>'correct')::boolean, 'ms', (e.v->>'ms')::int) order by e.i), '[]'::jsonb)
    into v_r1 from jsonb_array_elements(p_round1) with ordinality as e(v, i);
  select coalesce(jsonb_agg(jsonb_build_object('correct', (e.v->>'correct')::boolean) order by e.i), '[]'::jsonb)
    into v_r2 from jsonb_array_elements(p_round2) with ordinality as e(v, i);

  insert into public.duel_runs (duel_id, user_id, round1, round2, damage, time_ms)
  values (p_duel, v_me, v_r1, v_r2, public.duel_damage(v_r1, v_r2), public.duel_time(v_r1));

  perform public.settle_duel(p_duel);
  select status into v_status from public.duels where id = p_duel;
  return json_build_object('ok', true, 'status', v_status);
end $$;

-- 9. RPC: my duels of the last 90 days (settles expired ones first). The opponent's run is
-- returned only once the duel is settled.
create function public.list_duels() returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_res json;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  perform public.expire_duels(v_me);

  select coalesce(json_agg(q.j order by q.created desc), '[]'::json) into v_res from (
    select d.created_at as created, json_build_object(
      'id', d.id,
      'challenger', d.challenger,
      'opponent', d.opponent,
      'opponentPseudo', p.pseudo,
      'opponentAvatar', p.avatar_emoji,
      'createdAt', d.created_at,
      'expiresAt', d.expires_at,
      'status', d.status,
      'winner', d.winner,
      'seed', d.seed,
      'questions', d.questions,
      'myRun', (select json_build_object('round1', r.round1, 'round2', r.round2, 'damage', r.damage,
                                         'timeMs', r.time_ms, 'reward', r.reward, 'claimed', r.claimed)
                from public.duel_runs r where r.duel_id = d.id and r.user_id = v_me),
      'theirRun', case when d.status = 'settled' then
                  (select json_build_object('round1', r.round1, 'round2', r.round2, 'damage', r.damage,
                                            'timeMs', r.time_ms, 'reward', r.reward, 'claimed', r.claimed)
                   from public.duel_runs r where r.duel_id = d.id and r.user_id <> v_me)
                  else null end
    ) as j
    from public.duels d
    join public.profiles p on p.id = case when d.challenger = v_me then d.opponent else d.challenger end
    where (d.challenger = v_me or d.opponent = v_me) and d.created_at > now() - interval '90 days'
  ) q;
  return v_res;
end $$;

revoke execute on function public.create_duel(uuid, jsonb, int) from public, anon;
revoke execute on function public.submit_duel_run(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.list_duels() from public, anon;
grant execute on function public.create_duel(uuid, jsonb, int) to authenticated;
grant execute on function public.submit_duel_run(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.list_duels() to authenticated;

-- 10. Event projection: same body as 20261019000000_achievement_rewards.sql with two changes
-- (a purchase debits the item's currency; duel_settled credits Kim bai once, never XP).
create or replace function public.apply_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.user_stats%rowtype;
  v_today date := public.paris_today();
  v_week date := public.paris_week_start(public.paris_today());
  v_day date := (least(new.client_created_at, now()) at time zone 'Europe/Paris')::date;
  v_score int := case when new.payload->>'score' ~ '^[0-9]+(\.[0-9]+)?$'
    then least(100, greatest(0, round((new.payload->>'score')::numeric)))::int else null end;
  v_attempt uuid;
  v_credit int := 0;
  v_best_before int;
  v_item record;
  v_id text;
  v_slot text;
  v_reward int;
begin
  select * into s from public.user_stats where user_id = new.user_id for update;
  if not found then return new; end if;

  if s.today <> v_today then s.xp_today := 0; s.today := v_today; end if;
  if s.week_start <> v_week then s.xp_week := 0; s.week_start := v_week; end if;

  v_best_before := s.exam_best;

  if new.type = 'exam_finished' then
    -- Client xp is ignored. The event must reference one of the user's unscored attempts,
    -- otherwise it credits 0 (never raise: a raising trigger would block the whole sync batch).
    if new.payload->>'attemptId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_attempt := (new.payload->>'attemptId')::uuid;
    end if;
    if v_score is not null and v_attempt is not null then
      update public.exam_attempts set score = v_score
      where id = v_attempt and user_id = new.user_id and score is null;
      if found then
        v_credit := greatest(0, v_score - coalesce(s.exam_best, 0));
        s.exam_best := greatest(coalesce(s.exam_best, 0), v_score);
        s.coins := s.coins + public.coins_for_event(new.type, new.payload, v_best_before);
      end if;
    end if;
  elsif new.type in ('item_purchased','item_equipped','duel_settled') then
    v_credit := 0;
  else
    v_credit := new.xp;
    -- a badge pays only the first time it is unlocked
    if not (new.type = 'badge_unlocked' and new.ref_id = any(s.badges)) then
      s.coins := s.coins + public.coins_for_event(new.type, new.payload, v_best_before);
    end if;
  end if;
  v_credit := least(v_credit, greatest(0, 200 - s.xp_today));
  s.xp_total := s.xp_total + v_credit;
  s.xp_week := s.xp_week + v_credit;
  s.xp_today := s.xp_today + v_credit;

  if new.type = 'duel_settled' then
    -- The amount is the server's own (duel_runs.reward), paid once per duel; the client amount is ignored.
    -- Anything that does not match a settled, unclaimed run of this user credits nothing (never raises).
    if new.ref_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      update public.duel_runs set claimed = true
      where duel_id = new.ref_id::uuid and user_id = new.user_id and not claimed and reward is not null
      returning reward into v_reward;
      if found then s.kim_bai := s.kim_bai + v_reward; end if;
    end if;
  end if;

  if new.type = 'item_purchased' then
    -- Price and currency always come from the catalogue; reward-only items (price null) cannot be bought.
    -- A refused purchase has no effect (and never raises).
    v_id := new.payload->>'itemId';
    select * into v_item from public.shop_item(v_id);
    if found
       and v_item.price is not null
       and (case when v_item.currency = 'kim_bai' then s.kim_bai else s.coins end) >= v_item.price
       and not (v_item.kind = 'cosmetic' and v_id = any(s.inventory))
       and not (v_id = 'streak_freeze' and s.streak_freezes >= 2) then
      if v_item.currency = 'kim_bai' then
        s.kim_bai := s.kim_bai - v_item.price;
      else
        s.coins := s.coins - v_item.price;
      end if;
      if v_id = 'streak_freeze' then
        s.streak_freezes := s.streak_freezes + 1;
      elsif v_item.kind = 'cosmetic' then
        s.inventory := array_append(s.inventory, v_id);
      end if;
    end if;
  end if;

  if new.type = 'item_equipped' then
    v_slot := new.payload->>'slot';
    v_id := new.payload->>'itemId';
    if v_slot is not null then
      if v_id is null then
        s.equipped := s.equipped - v_slot;
      elsif v_id = any(s.inventory) and (select i.slot from public.shop_item(v_id) i) = v_slot then
        s.equipped := jsonb_set(s.equipped, array[v_slot], to_jsonb(v_id));
      end if;
    end if;
  end if;

  if new.type in ('lesson_completed','dialogue_completed','review_session_completed') then
    if s.last_active_day is null or v_day > s.last_active_day then
      if s.last_active_day = v_day - 1 then
        s.streak := s.streak + 1;
      elsif s.last_active_day is not null and (v_day - s.last_active_day - 1) <= s.streak_freezes then
        s.streak_freezes := s.streak_freezes - (v_day - s.last_active_day - 1);
        s.streak := s.streak + 1;
      else
        s.streak := 1;
      end if;
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
    -- first unlock of a badge also grants its reward item (inventory is a set)
    v_id := public.badge_reward(new.ref_id);
    if v_id is not null and not (v_id = any(s.inventory)) then
      s.inventory := array_append(s.inventory, v_id);
    end if;
  end if;

  update public.user_stats set
    xp_total = s.xp_total, xp_week = s.xp_week, week_start = s.week_start, xp_today = s.xp_today, today = s.today,
    streak = s.streak, last_active_day = s.last_active_day, lessons_done = s.lessons_done,
    dialogues_done = s.dialogues_done, badges = s.badges, exam_best = s.exam_best,
    coins = s.coins, inventory = s.inventory, equipped = s.equipped, streak_freezes = s.streak_freezes,
    kim_bai = s.kim_bai,
    updated_at = now()
  where user_id = new.user_id;
  return new;
end $$;
