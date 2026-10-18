set lock_timeout = '10s';

-- Dark legends cosmetics (hero cosmetics lot 2): four purchasable items, one per character slot.
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
    ('fx_embers', null::int, 'cosmetic', 'profile_fx'),
    ('hat_thuy_tinh', 60, 'cosmetic', 'hat'),
    ('aura_waves', 80, 'cosmetic', 'aura'),
    ('outfit_son_tinh', 90, 'cosmetic', 'outfit'),
    ('acc_thuan_thien', 120, 'cosmetic', 'accessory')
  ) as v(id, price, kind, slot) where v.id = p_id
$$;

revoke execute on function public.shop_item(text) from public, anon, authenticated;

-- 2. The one-shot back-fill of the achievement rewards migration has run; remove it.
drop function public.rewards_backfill();
