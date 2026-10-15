-- Coins and shop (spec Progression V2 §5–6). Never edit after it is applied to prod: add a new migration.

-- 1. New synced event types (session_started stays local-only and is never sent).
alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'lesson_completed','dialogue_completed','review_session_completed','exam_finished','badge_unlocked',
  'item_purchased','item_equipped'));

-- 2. Wallet columns.
alter table public.user_stats
  add column coins int not null default 0,
  add column inventory text[] not null default '{}',
  add column equipped jsonb not null default '{}',
  add column streak_freezes int not null default 0;

-- 3. Catalogue (must match src/content/shop.json).
create or replace function public.shop_item(p_id text) returns table(price int, kind text, slot text)
language sql immutable set search_path = '' as $$
  select v.price, v.kind, v.slot from (values
    ('energy_refill', 30, 'consumable', null::text),
    ('streak_freeze', 50, 'consumable', null::text),
    ('frame_bronze', 40, 'cosmetic', 'frame'),
    ('frame_jade', 80, 'cosmetic', 'frame'),
    ('frame_son_mai', 150, 'cosmetic', 'frame')
  ) as v(id, price, kind, slot) where v.id = p_id
$$;

-- 4. Coin earning rule for one event, given the best exam score BEFORE it (null = none).
create or replace function public.coins_for_event(p_type text, p_payload jsonb, p_best_before int) returns int
language sql immutable set search_path = '' as $$
  select case p_type
    when 'lesson_completed' then 10 + case when (p_payload->'perfect') = 'true'::jsonb then 5 else 0 end
    when 'dialogue_completed' then 5
    when 'review_session_completed' then 3
    when 'badge_unlocked' then 10
    when 'exam_finished' then case
      -- same normalisation as exam_best (v_score in apply_event): rounded, clamped to 0..100.
      -- never raise inside the trigger: a non-numeric score counts as 0
      when (case when p_payload->>'score' ~ '^[0-9]+(\.[0-9]+)?$'
            then least(100, greatest(0, round((p_payload->>'score')::numeric))) else 0 end) < 70 then 0
      when coalesce(p_best_before, 0) < 70 then 50
      else 20 end
    else 0 end
$$;

revoke execute on function public.shop_item(text) from public, anon, authenticated;
revoke execute on function public.coins_for_event(text, jsonb, int) from public, anon, authenticated;

-- 5. Event projection with coins, shop, equipment and streak freezes.
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
  elsif new.type in ('item_purchased','item_equipped') then
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

  if new.type = 'item_purchased' then
    -- Price always comes from the catalogue. A refused purchase has no effect (and never raises).
    v_id := new.payload->>'itemId';
    select * into v_item from public.shop_item(v_id);
    if found
       and s.coins >= v_item.price
       and not (v_item.kind = 'cosmetic' and v_id = any(s.inventory))
       and not (v_id = 'streak_freeze' and s.streak_freezes >= 2) then
      s.coins := s.coins - v_item.price;
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
  end if;

  update public.user_stats set
    xp_total = s.xp_total, xp_week = s.xp_week, week_start = s.week_start, xp_today = s.xp_today, today = s.today,
    streak = s.streak, last_active_day = s.last_active_day, lessons_done = s.lessons_done,
    dialogues_done = s.dialogues_done, badges = s.badges, exam_best = s.exam_best,
    coins = s.coins, inventory = s.inventory, equipped = s.equipped, streak_freezes = s.streak_freezes,
    updated_at = now()
  where user_id = new.user_id;
  return new;
end $$;

-- 6. Back-fill: credit events stored before this migration, in time order, with the same rule.
-- (Past exam wins are credited without checking the attempt; the trigger checks attempts from now on.
-- A badge counts once per (user, ref_id).)
update public.user_stats us set coins = coalesce(b.total, 0)
from (
  select user_id, sum(case when badge_rank > 1 then 0 else public.coins_for_event(type, payload, best_before) end) as total
  from (
    select e.user_id, e.type, e.payload,
      max(case when e.type = 'exam_finished' and e.payload->>'score' ~ '^[0-9]+(\.[0-9]+)?$'
            then least(100, greatest(0, round((e.payload->>'score')::numeric))) end)
        over (partition by e.user_id order by e.client_created_at, e.id rows between unbounded preceding and 1 preceding)::int as best_before,
      case when e.type = 'badge_unlocked'
        then row_number() over (partition by e.user_id, e.type, e.ref_id order by e.client_created_at, e.id) else 1 end as badge_rank
    from public.events e
  ) x
  group by user_id
) b
where b.user_id = us.user_id;

-- 7. Leaderboard exposes coins and the equipped frame (new columns appended at the end).
create or replace view public.leaderboard with (security_invoker = true) as
select
  us.user_id, us.group_id, p.pseudo, p.avatar_emoji,
  us.xp_total,
  case when us.week_start = public.paris_week_start(public.paris_today()) then us.xp_week else 0 end as xp_week,
  case when us.last_active_day >= public.paris_today() - 1 then us.streak else 0 end as streak,
  coalesce(array_length(us.lessons_done, 1), 0) as lessons_done_count,
  us.lessons_done, us.dialogues_done, us.badges, us.exam_best,
  us.coins, us.equipped->>'frame' as equipped_frame
from public.user_stats us
join public.profiles p on p.id = us.user_id;
