set lock_timeout = '10s';

-- Achievement rewards (hero cosmetics spec §3-4). Frames become reward-only, profile effects are added.
-- Never edit after it is applied to prod: add a new migration.

-- 1. Full catalogue (must match src/content/shop.json). price null = reward-only, not purchasable.
create or replace function public.shop_item(p_id text) returns table(price int, kind text, slot text)
language sql immutable set search_path = '' as $$
  select v.price, v.kind, v.slot from (values
    ('energy_refill', 30, 'consumable', null::text),
    ('streak_freeze', 50, 'consumable', null::text),
    ('frame_bronze', null::int, 'cosmetic', 'frame'),
    ('frame_jade', null::int, 'cosmetic', 'frame'),
    ('frame_son_mai', null::int, 'cosmetic', 'frame'),
    ('fx_ink', null::int, 'cosmetic', 'profile_fx'),
    ('fx_lightning', null::int, 'cosmetic', 'profile_fx'),
    ('fx_embers', null::int, 'cosmetic', 'profile_fx')
  ) as v(id, price, kind, slot) where v.id = p_id
$$;

-- 2. Badge -> reward item (must match the rewards in src/content).
create function public.badge_reward(p_badge text) returns text
language sql immutable set search_path = '' as $$
  select v.item from (values
    ('streak_7', 'frame_bronze'),
    ('ten_lessons', 'frame_jade'),
    ('exam_passed', 'frame_son_mai'),
    ('perfect_5', 'fx_ink'),
    ('exam_excellent', 'fx_lightning'),
    ('streak_30', 'fx_embers')
  ) as v(badge, item) where v.badge = p_badge
$$;

revoke execute on function public.shop_item(text) from public, anon, authenticated;
revoke execute on function public.badge_reward(text) from public, anon, authenticated;

-- 3. Event projection: same body as 20261015000000_coins_shop.sql with two changes
-- (purchase needs a price; a new badge grants its reward).
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
    -- Price always comes from the catalogue; reward-only items (price null) cannot be bought.
    -- A refused purchase has no effect (and never raises).
    v_id := new.payload->>'itemId';
    select * into v_item from public.shop_item(v_id);
    if found
       and v_item.price is not null
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
    updated_at = now()
  where user_id = new.user_id;
  return new;
end $$;

-- 4. One-shot back-fill: refund the frames bought under the old rules and grant the rewards of
-- badges already earned. Not meant to be re-run on live data (it would refund reward frames again).
create function public.rewards_backfill() returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_coins int;
  v_inventory text[];
  v_frame text;
  v_equipped jsonb;
begin
  for r in select user_id, coins, inventory, badges, equipped from public.user_stats loop
    -- old frame prices, hard-coded on purpose: frame_bronze 40, frame_jade 80, frame_son_mai 150
    v_coins := r.coins
      + case when 'frame_bronze' = any(r.inventory) then 40 else 0 end
      + case when 'frame_jade' = any(r.inventory) then 80 else 0 end
      + case when 'frame_son_mai' = any(r.inventory) then 150 else 0 end;

    -- inventory without the three old frames, plus the reward of every badge already earned
    select coalesce(array_agg(distinct x), '{}') into v_inventory from (
      select i as x from unnest(r.inventory) i
      where i not in ('frame_bronze', 'frame_jade', 'frame_son_mai')
      union
      select public.badge_reward(b) from unnest(r.badges) b where public.badge_reward(b) is not null
    ) q;

    -- replay frame equips: an equip counts only if it clears the slot or the reward was earned before it
    select (e.payload->>'itemId') into v_frame
    from public.events e
    where e.user_id = r.user_id and e.type = 'item_equipped' and e.payload->>'slot' = 'frame'
      and (
        e.payload->>'itemId' is null
        or (
          (e.payload->>'itemId') = any(v_inventory)
          and exists (
            select 1 from public.events bu
            where bu.user_id = r.user_id and bu.type = 'badge_unlocked'
              and public.badge_reward(bu.ref_id) = e.payload->>'itemId'
              and (bu.client_created_at, bu.id) < (e.client_created_at, e.id)
          )
        )
      )
    order by e.client_created_at desc, e.id desc
    limit 1;

    v_equipped := coalesce(r.equipped, '{}'::jsonb) - 'frame';
    if v_frame is not null then
      v_equipped := jsonb_set(v_equipped, array['frame'], to_jsonb(v_frame));
    end if;

    update public.user_stats
    set coins = v_coins, inventory = v_inventory, equipped = v_equipped
    where user_id = r.user_id;
  end loop;
end $$;

revoke execute on function public.rewards_backfill() from public, anon, authenticated;

select public.rewards_backfill();

-- 5. Leaderboard also exposes the full equipped map (new column appended at the end).
create or replace view public.leaderboard with (security_invoker = true) as
select
  us.user_id, us.group_id, p.pseudo, p.avatar_emoji,
  us.xp_total,
  case when us.week_start = public.paris_week_start(public.paris_today()) then us.xp_week else 0 end as xp_week,
  case when us.last_active_day >= public.paris_today() - 1 - us.streak_freezes then us.streak else 0 end as streak,
  coalesce(array_length(us.lessons_done, 1), 0) as lessons_done_count,
  us.lessons_done, us.dialogues_done, us.badges, us.exam_best,
  us.coins, us.equipped->>'frame' as equipped_frame,
  us.equipped
from public.user_stats us
join public.profiles p on p.id = us.user_id;
