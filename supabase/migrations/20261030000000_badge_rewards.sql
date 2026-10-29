set lock_timeout = '10s';

-- Badge rewards in xu (energy and badge rewards spec 2026-10-29 §2). Never edit after it is applied to prod: add a new migration.
-- The amounts live here AND in src/content/badges.json (`coins`); parity is checked by src/content/shopParity.test.ts.

-- 1. xu paid by the first unlock of a badge; 0 for an unknown id (a forged badge pays nothing).
create function public.badge_coins(p_badge text) returns int
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
    ('days_30', 150)
  ) as v(badge, coins) where v.badge = p_badge), 0)
$$;
revoke execute on function public.badge_coins(text) from public, anon, authenticated;

-- 2. Event projection: same body as 20261029000000_daily_bonus.sql with one change: badge_unlocked pays badge_coins(ref_id)
-- instead of the flat 10 of coins_for_event.
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
  v_bonus_day date;
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
  elsif new.type in ('item_purchased','item_equipped','duel_settled','gacha_pulled','daily_bonus_claimed') then
    v_credit := 0;
  else
    v_credit := new.xp;
    -- a badge pays its own amount (badge_coins, 0 when unknown), only the first time it is unlocked
    if new.type = 'badge_unlocked' then
      if not (new.ref_id = any(s.badges)) then
        s.coins := s.coins + public.badge_coins(new.ref_id);
      end if;
    else
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

  if new.type = 'daily_bonus_claimed' then
    -- One bonus per Paris day: ref_id is the day of the event, today or yesterday (an offline claim synced the next
    -- morning), and later than the last bonus. The amount is the server's own; anything else credits nothing (never raises).
    if new.ref_id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      begin
        v_bonus_day := new.ref_id::date;
      exception when others then
        v_bonus_day := null;
      end;
    end if;
    if v_bonus_day is not null
       and v_bonus_day = v_day
       and v_bonus_day >= v_today - 1
       and (s.bonus_day is null or v_bonus_day > s.bonus_day) then
      s.bonus_streak := case when s.bonus_day = v_bonus_day - 1 then s.bonus_streak % 7 + 1 else 1 end;
      s.bonus_day := v_bonus_day;
      s.coins := s.coins + public.daily_bonus_amount(s.bonus_streak);
    end if;
  end if;

  if new.type = 'gacha_pulled' then
    -- gacha_pull already debited, refunded and stocked the inventory: only mark the user's own pull as claimed.
    if new.ref_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      update public.gacha_pulls set claimed = true
      where id = new.ref_id::uuid and user_id = new.user_id and not claimed;
    end if;
  end if;

  if new.type = 'item_purchased' then
    -- Price and currency always come from the catalogue; reward-only and gacha items (price null) cannot be bought.
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
    kim_bai = s.kim_bai, bonus_day = s.bonus_day, bonus_streak = s.bonus_streak,
    updated_at = now()
  where user_id = new.user_id;
  return new;
end $$;

-- 3. One-shot catch-up: badges already unlocked were paid 10 each; pay the difference up to their new amount.
-- (The app replays its journal with the new amounts, so both balances stay equal.) Unknown ids are left as they are.
update public.user_stats us set coins = us.coins + c.extra
from (
  select user_id, sum(greatest(0, public.badge_coins(b) - 10))::int as extra
  from public.user_stats, unnest(badges) b
  group by user_id
) c
where c.user_id = us.user_id and c.extra > 0;
