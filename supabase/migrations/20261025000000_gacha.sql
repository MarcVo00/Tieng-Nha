set lock_timeout = '10s';

-- Server-side gacha "Xin xam" (gacha spec 2026-10-21 §3-§7): rarities in the catalogue, xu cosmetics no longer
-- directly purchasable, pure draw rules fed by explicit rolls, an idempotent `gacha_pull` RPC, per-theme pity.
-- Never edit after it is applied to prod: add a new migration.
-- The draw rules live here AND in src/services/gacha.ts; the cases are mirrored in tests (supabase/tests/06_gacha_test.sql).

-- 1. New synced event type.
alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'lesson_completed','dialogue_completed','review_session_completed','exam_finished','badge_unlocked',
  'item_purchased','item_equipped','duel_settled','gacha_pulled'));

-- 2. Pity counter: items drawn since the last legendary, per theme ({ "legendes_sombres": 12 }).
alter table public.user_stats add column gacha_pity jsonb not null default '{}';

-- 3. Pulls. Reads and writes only go through the RPCs (RLS on, no policy). id = the client's pull id (idempotency key).
create table public.gacha_pulls (
  id uuid primary key,
  user_id uuid not null references public.profiles on delete cascade,
  theme text not null,
  count int not null check (count in (1, 10)),
  cost int not null check (cost >= 0),
  results jsonb not null,
  created_at timestamptz not null default now(),
  claimed boolean not null default false
);
create index gacha_pulls_user_claimed_created on public.gacha_pulls (user_id, claimed, created_at);
alter table public.gacha_pulls enable row level security;
-- RPC-only table: no direct access at all (TRUNCATE and REFERENCES ignore RLS).
revoke all on public.gacha_pulls from anon, authenticated;

-- 4. Catalogue (must match src/content/shop.json). Rows are read through shop_items() (enumeration, used by the
-- draw) and shop_item(id). A gacha item is an xu cosmetic with a theme and a rarity and price null: it can never be
-- bought directly, not even by a forged item_purchased event (apply_event refuses price null).
-- The return type of shop_item changes: drop + recreate.
drop function public.shop_item(text);
create function public.shop_items() returns table(id text, price int, kind text, slot text, currency text, theme text, rarity text)
language sql immutable set search_path = '' as $$
  select v.id, v.price, v.kind, v.slot, v.currency, v.theme, v.rarity from (values
    ('energy_refill', 30, 'consumable', null::text, 'xu', null::text, null::text),
    ('streak_freeze', 50, 'consumable', null::text, 'xu', null::text, null::text),
    ('frame_bronze', null::int, 'cosmetic', 'frame', 'xu', null::text, null::text),
    ('frame_jade', null::int, 'cosmetic', 'frame', 'xu', null::text, null::text),
    ('frame_son_mai', null::int, 'cosmetic', 'frame', 'xu', null::text, null::text),
    ('fx_ink', null::int, 'cosmetic', 'profile_fx', 'xu', null::text, null::text),
    ('fx_lightning', null::int, 'cosmetic', 'profile_fx', 'xu', null::text, null::text),
    ('fx_embers', null::int, 'cosmetic', 'profile_fx', 'xu', null::text, null::text),
    ('hat_thuy_tinh', null::int, 'cosmetic', 'hat', 'xu', 'legendes_sombres', 'rare'),
    ('aura_waves', null::int, 'cosmetic', 'aura', 'xu', 'legendes_sombres', 'rare'),
    ('outfit_son_tinh', null::int, 'cosmetic', 'outfit', 'xu', 'legendes_sombres', 'epic'),
    ('acc_thuan_thien', null::int, 'cosmetic', 'accessory', 'xu', 'legendes_sombres', 'epic'),
    ('char_kiem_khach', null::int, 'cosmetic', 'character', 'xu', 'legendes_sombres', 'epic'),
    ('char_phap_su', null::int, 'cosmetic', 'character', 'xu', 'legendes_sombres', 'legendary'),
    ('acc_giao_tre', null::int, 'cosmetic', 'accessory', 'xu', 'legendes_sombres', 'common'),
    ('hat_khan_vanh', null::int, 'cosmetic', 'hat', 'xu', 'legendes_sombres', 'common'),
    ('outfit_ao_chen', null::int, 'cosmetic', 'outfit', 'xu', 'legendes_sombres', 'common'),
    ('aura_suong_mu', null::int, 'cosmetic', 'aura', 'xu', 'legendes_sombres', 'common'),
    ('acc_quat_sat', null::int, 'cosmetic', 'accessory', 'xu', 'legendes_sombres', 'rare'),
    ('hat_mu_chien', null::int, 'cosmetic', 'hat', 'xu', 'legendes_sombres', 'rare'),
    ('hat_tay_son', 6, 'cosmetic', 'hat', 'kim_bai', 'arene', null::text),
    ('acc_con_vo', 8, 'cosmetic', 'accessory', 'kim_bai', 'arene', null::text),
    ('outfit_hoi_vat', 10, 'cosmetic', 'outfit', 'kim_bai', 'arene', null::text)
  ) as v(id, price, kind, slot, currency, theme, rarity)
$$;

create function public.shop_item(p_id text) returns table(price int, kind text, slot text, currency text, theme text, rarity text)
language sql immutable set search_path = '' as $$
  select s.price, s.kind, s.slot, s.currency, s.theme, s.rarity from public.shop_items() s where s.id = p_id
$$;

-- 5. Pure rules (spec §3, §4).
-- Price in xu of a pull of p_count items: 1 -> 40, 10 -> 360; null for any other count.
create function public.gacha_cost(p_count int) returns int
language sql immutable set search_path = '' as $$
  select case p_count when 1 then 40 when 10 then 360 else null end
$$;

-- xu refunded for a duplicate, by rarity.
create function public.gacha_refund(p_rarity text) returns int
language sql immutable set search_path = '' as $$
  select case p_rarity when 'common' then 8 when 'rare' then 20 when 'epic' then 50 when 'legendary' then 120 else 0 end
$$;

-- The draw. Pure: no randomness, no table access except the catalogue. Rolls are floats in [0,1), two per item
-- (rolls[2i-1] chooses the rarity, rolls[2i] the item), i = 1..p_count.
--   * pity: the counter advances by 1 per item; the item for which the counter would reach 40 (p_pity + 1 >= 40)
--     is forced legendary; the counter resets to 0 on any legendary item, otherwise it is the advanced counter.
--   * otherwise the rarity is common if r < 0.60, rare if r < 0.88, epic if r < 0.98, else legendary.
--   * x10 (p_count = 10): if the first 9 items are all common, the 10th is at least rare.
--   * the item is picked among the theme's gacha items of that rarity, sorted by id (C collation), at index
--     min(floor(r2 * n), n - 1). A rarity with no item steps down to the next lower rarity that has items (then, if
--     none, up to the nearest higher one). The returned rarity is the rarity of the item actually drawn.
--   * duplicate = in p_inventory or drawn earlier in this pull; refund by rarity, 0 for a new item.
-- Returns { items: [{ itemId, rarity, duplicate, refund }], pity }.
create function public.gacha_draw(p_theme text, p_inventory text[], p_pity int, p_count int, p_rolls float8[]) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_ranks constant text[] := array['common', 'rare', 'epic', 'legendary'];
  v_pity int := greatest(coalesce(p_pity, 0), 0);
  v_seen text[] := coalesce(p_inventory, '{}');
  v_items jsonb := '[]'::jsonb;
  v_all_common boolean := true;
  v_r1 float8;
  v_r2 float8;
  v_rank int;
  v_k int;
  v_pool text[];
  v_id text;
  v_rarity text;
  v_dup boolean;
  v_refund int;
begin
  if p_count is null or p_count < 1 or p_rolls is null or coalesce(array_length(p_rolls, 1), 0) < 2 * p_count then
    raise exception 'gacha_draw: need two rolls per item';
  end if;

  for i in 1..p_count loop
    v_r1 := p_rolls[2 * i - 1];
    v_r2 := p_rolls[2 * i];
    if v_r1 is null or v_r2 is null then raise exception 'gacha_draw: null roll'; end if;

    if v_pity + 1 >= 40 then v_rank := 4;
    elsif v_r1 < 0.60 then v_rank := 1;
    elsif v_r1 < 0.88 then v_rank := 2;
    elsif v_r1 < 0.98 then v_rank := 3;
    else v_rank := 4;
    end if;
    if p_count = 10 and i = 10 and v_all_common then v_rank := greatest(v_rank, 2); end if;

    -- pool of the wanted rarity, else the next lower rarity that has items, else the nearest higher one
    v_pool := '{}';
    for v_k in reverse v_rank..1 loop
      select coalesce(array_agg(s.id order by s.id collate "C"), '{}') into v_pool
      from public.shop_items() s
      where s.theme = p_theme and s.rarity = v_ranks[v_k] and s.currency = 'xu' and s.price is null;
      exit when array_length(v_pool, 1) is not null;
    end loop;
    if array_length(v_pool, 1) is null then
      for v_k in (v_rank + 1)..4 loop
        select coalesce(array_agg(s.id order by s.id collate "C"), '{}') into v_pool
        from public.shop_items() s
        where s.theme = p_theme and s.rarity = v_ranks[v_k] and s.currency = 'xu' and s.price is null;
        exit when array_length(v_pool, 1) is not null;
      end loop;
    end if;
    if array_length(v_pool, 1) is null then raise exception 'gacha_draw: empty theme'; end if;

    v_id := v_pool[1 + least(greatest(floor(v_r2 * array_length(v_pool, 1))::int, 0), array_length(v_pool, 1) - 1)];
    select s.rarity into v_rarity from public.shop_items() s where s.id = v_id;
    v_dup := v_id = any(v_seen);
    v_refund := case when v_dup then public.gacha_refund(v_rarity) else 0 end;
    if not v_dup then v_seen := array_append(v_seen, v_id); end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'itemId', v_id, 'rarity', v_rarity, 'duplicate', v_dup, 'refund', v_refund));
    v_all_common := v_all_common and v_rarity = 'common';
    v_pity := case when v_rarity = 'legendary' then 0 else v_pity + 1 end;
  end loop;

  return jsonb_build_object('items', v_items, 'pity', v_pity);
end $$;

revoke execute on function public.shop_items() from public, anon, authenticated;
revoke execute on function public.shop_item(text) from public, anon, authenticated;
revoke execute on function public.gacha_cost(int) from public, anon, authenticated;
revoke execute on function public.gacha_refund(text) from public, anon, authenticated;
revoke execute on function public.gacha_draw(text, text[], int, int, float8[]) from public, anon, authenticated;

-- 6. RPC: pull. Server-authoritative: debits xu, credits refunds, adds new items and moves the pity counter in
-- user_stats directly. Idempotent on p_pull (the client's uuid): a repeated call returns the stored result and
-- changes nothing. The user_stats row is locked first, so concurrent calls (same or different pull ids) serialise.
-- Business refusals return { ok: false, error }: bad_pull, unknown_user, bad_count, unknown_theme, not_enough.
create function public.gacha_pull(p_pull uuid, p_theme text, p_count int) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  s public.user_stats%rowtype;
  v_old public.gacha_pulls%rowtype;
  v_cost int;
  v_rolls float8[];
  v_draw jsonb;
  v_items jsonb;
  v_refunds int;
  v_new text[];
  v_pity int;
  v_created timestamptz;
  v_coins int;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_pull is null then return json_build_object('ok', false, 'error', 'bad_pull'); end if;

  select * into s from public.user_stats where user_id = v_me for update;
  if not found then return json_build_object('ok', false, 'error', 'unknown_user'); end if;

  -- replay: same result, no second debit
  select * into v_old from public.gacha_pulls where id = p_pull;
  if found then
    if v_old.user_id <> v_me then return json_build_object('ok', false, 'error', 'bad_pull'); end if;
    return json_build_object('ok', true, 'id', v_old.id, 'theme', v_old.theme, 'count', v_old.count,
      'cost', v_old.cost, 'items', v_old.results, 'createdAt', v_old.created_at, 'claimed', v_old.claimed,
      'pity', coalesce((s.gacha_pity->>v_old.theme)::int, 0), 'coins', s.coins, 'replayed', true);
  end if;

  v_cost := public.gacha_cost(p_count);
  if v_cost is null then return json_build_object('ok', false, 'error', 'bad_count'); end if;
  if p_theme is null or not exists (
    select 1 from public.shop_items() i
    where i.theme = p_theme and i.rarity is not null and i.currency = 'xu' and i.price is null) then
    return json_build_object('ok', false, 'error', 'unknown_theme');
  end if;
  if s.coins < v_cost then return json_build_object('ok', false, 'error', 'not_enough'); end if;

  select array_agg(random()) into v_rolls from generate_series(1, 2 * p_count);
  v_draw := public.gacha_draw(p_theme, s.inventory, coalesce((s.gacha_pity->>p_theme)::int, 0), p_count, v_rolls);
  v_items := v_draw->'items';
  v_pity := (v_draw->>'pity')::int;
  select coalesce(sum((e->>'refund')::int), 0)::int into v_refunds from jsonb_array_elements(v_items) e;
  select coalesce(array_agg(t.e->>'itemId' order by t.o), '{}') into v_new
  from jsonb_array_elements(v_items) with ordinality as t(e, o) where (t.e->>'duplicate') = 'false';

  insert into public.gacha_pulls (id, user_id, theme, count, cost, results)
  values (p_pull, v_me, p_theme, p_count, v_cost, v_items)
  on conflict (id) do nothing
  returning created_at into v_created;
  if not found then return json_build_object('ok', false, 'error', 'bad_pull'); end if;

  update public.user_stats set
    coins = coins - v_cost + v_refunds,
    inventory = inventory || v_new,
    gacha_pity = jsonb_set(gacha_pity, array[p_theme], to_jsonb(v_pity)),
    updated_at = now()
  where user_id = v_me
  returning coins into v_coins;

  return json_build_object('ok', true, 'id', p_pull, 'theme', p_theme, 'count', p_count, 'cost', v_cost,
    'items', v_items, 'createdAt', v_created, 'claimed', false, 'pity', v_pity, 'coins', v_coins, 'replayed', false);
end $$;

-- 7. RPC: my pulls. Every unclaimed pull (never omitted), then the 20 latest claimed ones.
create function public.list_gacha_pulls() returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_res json;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  select coalesce(json_agg(q.j order by q.claimed, q.created desc, q.id), '[]'::json) into v_res from (
    select r.id, r.claimed, r.created_at as created, json_build_object(
      'id', r.id, 'theme', r.theme, 'count', r.count, 'cost', r.cost, 'items', r.results,
      'createdAt', r.created_at, 'claimed', r.claimed) as j
    from (
      select p.*, row_number() over (partition by p.claimed order by p.created_at desc, p.id) as rn
      from public.gacha_pulls p where p.user_id = v_me
    ) r
    where not r.claimed or r.rn <= 20
  ) q;
  return v_res;
end $$;

revoke execute on function public.gacha_pull(uuid, text, int) from public, anon;
revoke execute on function public.list_gacha_pulls() from public, anon;
grant execute on function public.gacha_pull(uuid, text, int) to authenticated;
grant execute on function public.list_gacha_pulls() to authenticated;

-- 8. Event projection: same body as 20261022000000_duels.sql with one change: gacha_pulled never gives XP or xu
-- (the pull already applied everything); it only marks the user's own pull as claimed, once. A forged or unknown
-- pull id does nothing (never raises).
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
  elsif new.type in ('item_purchased','item_equipped','duel_settled','gacha_pulled') then
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
    kim_bai = s.kim_bai,
    updated_at = now()
  where user_id = new.user_id;
  return new;
end $$;
