begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'alice@test.fr');
insert into public.groups (id, name, invite_code) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.ev(t text, p jsonb default '{}', ts timestamptz default now(), r text default 'x') returns void
language sql as $$
  insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), t, r, 0, p, ts)
$$;

create function pg_temp.coins() returns int language sql as $$
  select coins from public.user_stats where user_id = auth.uid()
$$;

create function pg_temp.inv() returns text[] language sql as $$
  select inventory from public.user_stats where user_id = auth.uid()
$$;

create function pg_temp.eq(k text) returns text language sql as $$
  select equipped->>k from public.user_stats where user_id = auth.uid()
$$;

-- ---------- catalogue (as postgres) ----------
select is((select coalesce(price::text, 'null') || '/' || kind || '/' || slot from public.shop_item('hat_thuy_tinh')), 'null/cosmetic/hat', 'hat_thuy_tinh: gacha-only (no price), cosmetic, hat');
select is((select coalesce(price::text, 'null') || '/' || kind || '/' || slot from public.shop_item('aura_waves')), 'null/cosmetic/aura', 'aura_waves: gacha-only (no price), cosmetic, aura');
select is((select coalesce(price::text, 'null') || '/' || kind || '/' || slot from public.shop_item('outfit_son_tinh')), 'null/cosmetic/outfit', 'outfit_son_tinh: gacha-only (no price), cosmetic, outfit');
select is((select coalesce(price::text, 'null') || '/' || kind || '/' || slot from public.shop_item('acc_thuan_thien')), 'null/cosmetic/accessory', 'acc_thuan_thien: gacha-only (no price), cosmetic, accessory');

-- ---------- purchases: the four are gacha-only since the gacha migration, so a purchase is always refused ----------
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
reset role;
update public.user_stats set coins = 1000 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');

select pg_temp.ev('item_purchased', '{"itemId": "hat_thuy_tinh"}');
select is(pg_temp.coins(), 1000, 'hat_thuy_tinh can no longer be bought');
select ok(not ('hat_thuy_tinh' = any(pg_temp.inv())), 'hat_thuy_tinh is not in the inventory');
select pg_temp.ev('item_purchased', '{"itemId": "hat_thuy_tinh"}');
select is(pg_temp.coins(), 1000, 'a second attempt is refused too');

select pg_temp.ev('item_purchased', '{"itemId": "aura_waves"}');
select is(pg_temp.coins(), 1000, 'aura_waves can no longer be bought');
select pg_temp.ev('item_purchased', '{"itemId": "outfit_son_tinh"}');
select is(pg_temp.coins(), 1000, 'outfit_son_tinh can no longer be bought');
reset role;
update public.user_stats set coins = 100 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ev('item_purchased', '{"itemId": "acc_thuan_thien"}');
select is(pg_temp.coins(), 100, 'acc_thuan_thien is refused when coins are short');
reset role;
update public.user_stats set coins = 770 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ev('item_purchased', '{"itemId": "acc_thuan_thien"}');
select is(pg_temp.coins(), 770, 'acc_thuan_thien is refused even with enough coins');
select is(cardinality(pg_temp.inv()), 0, 'none of the four reached the inventory');
-- the player now owns them (a gacha pull, or a purchase made before the gacha migration)
reset role;
update public.user_stats set inventory = '{hat_thuy_tinh,aura_waves,outfit_son_tinh,acc_thuan_thien}' where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');

-- ---------- equipment ----------
select pg_temp.ev('item_equipped', '{"slot": "hat", "itemId": "hat_thuy_tinh"}');
select is(pg_temp.eq('hat'), 'hat_thuy_tinh', 'an owned hat can be equipped');
select pg_temp.ev('item_equipped', '{"slot": "outfit", "itemId": "hat_thuy_tinh"}');
select is(pg_temp.eq('outfit'), null, 'a hat cannot go in the outfit slot');

select pg_temp.ev('item_equipped', '{"slot": "outfit", "itemId": "outfit_son_tinh"}');
select is(pg_temp.eq('outfit'), 'outfit_son_tinh', 'an owned outfit can be equipped');
select pg_temp.ev('item_equipped', '{"slot": "aura", "itemId": "aura_waves"}');
select is(pg_temp.eq('aura'), 'aura_waves', 'an owned aura can be equipped');
select pg_temp.ev('item_equipped', '{"slot": "accessory", "itemId": "acc_thuan_thien"}');
select is(pg_temp.eq('accessory'), 'acc_thuan_thien', 'an owned accessory can be equipped');

-- ---------- one-shot back-fill is gone ----------
reset role;
select hasnt_function('public', 'rewards_backfill', 'rewards_backfill no longer exists');

select * from finish();
rollback;
