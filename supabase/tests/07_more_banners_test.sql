begin;
create extension if not exists pgtap with schema extensions;
select plan(68);

-- Two more gacha themes (more-banners spec §3, §4.2): seigneur_des_mers and esprits_de_la_nuit, 12 items each.
-- The rules (prices, rates, pity, refunds) are those of 20261025000000_gacha.sql and stay unchanged.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.fr'),
  ('b0000000-0000-0000-0000-000000000002', 'bob@test.fr');
insert into public.groups (id, name, invite_code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.ev(t text, r text default 'x', p jsonb default '{}', x int default 0) returns void
language sql as $$
  insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), t, r, x, p, now())
$$;

create function pg_temp.coins() returns int language sql as $$
  select coins from public.user_stats where user_id = auth.uid()
$$;
create function pg_temp.inv() returns text[] language sql as $$
  select inventory from public.user_stats where user_id = auth.uid()
$$;
create function pg_temp.pity(theme text) returns int language sql as $$
  select coalesce((gacha_pity->>theme)::int, 0) from public.user_stats where user_id = auth.uid()
$$;
create function pg_temp.err(j json) returns text language sql as $$ select j->>'error' $$;

create function pg_temp.rep(r1 float8, r2 float8, n int) returns float8[] language sql as $$
  select coalesce(array_agg(x order by i, k), '{}') from generate_series(1, n) i, unnest(array[r1, r2]) with ordinality as t(x, k)
$$;
create function pg_temp.seq(j jsonb) returns text language sql as $$
  select string_agg((e->>'itemId') || case when (e->>'duplicate')::boolean then '*' else '' end, ',' order by o)
  from jsonb_array_elements(j->'items') with ordinality as t(e, o)
$$;
create function pg_temp.rar(j jsonb) returns text language sql as $$
  select string_agg(substr(e->>'rarity', 1, 1), '' order by o) from jsonb_array_elements(j->'items') with ordinality as t(e, o)
$$;
create function pg_temp.one(theme text, r1 float8, r2 float8, pity int default 0) returns text language sql as $$
  select pg_temp.seq(public.gacha_draw(theme, '{}', pity, 1, array[r1, r2]::float8[]))
$$;
create function pg_temp.set(theme text) returns text language sql as $$
  select string_agg(id || ':' || rarity || ':' || slot, ',' order by id collate "C") from public.shop_items() where theme = $1
$$;
-- Draws over a grid of rolls (r1, r2 in 0, 0.02, ..., 0.98 and 0.9999) whose item is NOT of the drawn theme.
create function pg_temp.strays(theme text) returns int language sql as $$
  select count(*)::int from
    (select g / 50.0 as r from generate_series(0, 49) g union all select 0.9999) a(r1),
    (select g / 50.0 as r from generate_series(0, 49) g union all select 0.9999) b(r2),
    lateral jsonb_array_elements(public.gacha_draw(theme, '{}', 0, 1, array[a.r1, b.r2]::float8[])->'items') e
  where (select s.theme from public.shop_items() s where s.id = e->>'itemId') is distinct from theme
$$;
-- Items of a pull response that are not of the given theme.
create function pg_temp.off(r json, theme text) returns int language sql as $$
  select count(*)::int from json_array_elements(r->'items') e
  where (select s.theme from public.shop_items() s where s.id = e->>'itemId') is distinct from theme
$$;

-- ---------- catalogue (as postgres) ----------
select is((select count(*)::int from public.shop_items()), 47, 'the catalogue has 23 + 24 rows');
select is((select count(*)::int from public.shop_items() where theme = 'seigneur_des_mers' and rarity is not null and currency = 'xu' and price is null and kind = 'cosmetic'), 12, 'seigneur_des_mers has 12 gacha items');
select is((select count(*)::int from public.shop_items() where theme = 'esprits_de_la_nuit' and rarity is not null and currency = 'xu' and price is null and kind = 'cosmetic'), 12, 'esprits_de_la_nuit has 12 gacha items');
select is(pg_temp.set('seigneur_des_mers'),
  'acc_dinh_ba:rare:accessory,acc_kiem_rong:legendary:accessory,acc_mai_cheo:common:accessory,aura_bot_bien:common:aura,'
  'aura_ngoc_trai:rare:aura,char_lac_long_quan:epic:character,hat_khan_song:common:hat,hat_mu_rong:epic:hat,'
  'hat_vuong_mien_san_ho:rare:hat,outfit_ao_luoi:common:outfit,outfit_ao_thuy_trieu:rare:outfit,outfit_giap_vay_rong:epic:outfit',
  'seigneur_des_mers: ids, rarities and slots of spec §4.2');
select is(pg_temp.set('esprits_de_la_nuit'),
  'acc_long_den:common:accessory,acc_quat_giay:rare:accessory,aura_dom_dom:common:aura,aura_khoi_huong:rare:aura,'
  'aura_ma_troi:epic:aura,char_ho_ly:legendary:character,char_thay_phap:epic:character,hat_khan_den:common:hat,'
  'hat_mat_na_cao:epic:hat,hat_tram_chuong:rare:hat,outfit_ao_dem:common:outfit,outfit_ao_khoi:rare:outfit',
  'esprits_de_la_nuit: ids, rarities and slots of spec §4.2');
select is(pg_temp.set('legendes_sombres'),
  'acc_giao_tre:common:accessory,acc_quat_sat:rare:accessory,acc_thuan_thien:epic:accessory,aura_suong_mu:common:aura,'
  'aura_waves:rare:aura,char_kiem_khach:epic:character,char_phap_su:legendary:character,hat_khan_vanh:common:hat,'
  'hat_mu_chien:rare:hat,hat_thuy_tinh:rare:hat,outfit_ao_chen:common:outfit,outfit_son_tinh:epic:outfit',
  'legendes_sombres is unchanged');
select is((select count(*)::int from public.shop_items() where rarity is not null and (price is not null or currency <> 'xu' or theme is null or kind <> 'cosmetic')), 0, 'every rarity item is an xu cosmetic with a theme and no price');
select is((select count(*)::int from public.shop_items() where rarity is null), 11, 'the 11 non-gacha rows are still there');
select is((select string_agg(id || '/' || price || '/' || currency, ',' order by id) from public.shop_items() where price is not null),
  'acc_con_vo/8/kim_bai,energy_refill/30/xu,hat_tay_son/6/kim_bai,outfit_hoi_vat/10/kim_bai,streak_freeze/50/xu', 'priced items are unchanged');
select is((select count(*)::int from (select id from public.shop_items() group by id having count(*) > 1) d), 0, 'item ids are unique');
select is((select rarity || '/' || theme || '/' || slot || '/' || coalesce(price::text, 'null') from public.shop_item('char_ho_ly')), 'legendary/esprits_de_la_nuit/character/null', 'shop_item sees the new rows');
select is((select rarity || '/' || theme || '/' || slot from public.shop_item('acc_kiem_rong')), 'legendary/seigneur_des_mers/accessory', 'shop_item: the sea lord''s legendary');
select is(public.gacha_cost(1) || '/' || public.gacha_cost(10) || '/' || public.gacha_refund('common') || '/' || public.gacha_refund('legendary'), '40/360/8/120', 'prices and refunds are unchanged');

-- ---------- draw: seigneur_des_mers ----------
select is(pg_temp.one('seigneur_des_mers', 0.1, 0.0), 'acc_mai_cheo', 'sea: common index 0');
select is(pg_temp.one('seigneur_des_mers', 0.1, 0.25), 'aura_bot_bien', 'sea: common index 1');
select is(pg_temp.one('seigneur_des_mers', 0.1, 0.5), 'hat_khan_song', 'sea: common index 2');
select is(pg_temp.one('seigneur_des_mers', 0.1, 0.9999), 'outfit_ao_luoi', 'sea: common last index');
select is(pg_temp.one('seigneur_des_mers', 0.7, 0.0), 'acc_dinh_ba', 'sea: rare index 0');
select is(pg_temp.one('seigneur_des_mers', 0.7, 0.5), 'hat_vuong_mien_san_ho', 'sea: rare index 2');
select is(pg_temp.one('seigneur_des_mers', 0.7, 0.75), 'outfit_ao_thuy_trieu', 'sea: rare index 3');
select is(pg_temp.one('seigneur_des_mers', 0.9, 0.0), 'char_lac_long_quan', 'sea: epic index 0');
select is(pg_temp.one('seigneur_des_mers', 0.9, 0.34), 'hat_mu_rong', 'sea: epic index 1');
select is(pg_temp.one('seigneur_des_mers', 0.9, 0.67), 'outfit_giap_vay_rong', 'sea: epic index 2');
select is(pg_temp.one('seigneur_des_mers', 0.98, 0.5), 'acc_kiem_rong', 'sea: the single legendary');
select is(pg_temp.one('seigneur_des_mers', 0.1, 0.0, 39), 'acc_kiem_rong', 'sea: pity 39 forces the legendary');
select is(pg_temp.rar(public.gacha_draw('seigneur_des_mers', '{}', 0, 10, pg_temp.rep(0.1, 0.0, 10))), 'cccccccccr', 'sea: x10 rare guarantee');
select is(pg_temp.strays('seigneur_des_mers'), 0, 'sea: every draw over a 51x51 roll grid is a sea item');

-- ---------- draw: esprits_de_la_nuit ----------
select is(pg_temp.one('esprits_de_la_nuit', 0.1, 0.0), 'acc_long_den', 'night: common index 0');
select is(pg_temp.one('esprits_de_la_nuit', 0.1, 0.25), 'aura_dom_dom', 'night: common index 1');
select is(pg_temp.one('esprits_de_la_nuit', 0.1, 0.5), 'hat_khan_den', 'night: common index 2');
select is(pg_temp.one('esprits_de_la_nuit', 0.1, 0.75), 'outfit_ao_dem', 'night: common index 3');
select is(pg_temp.one('esprits_de_la_nuit', 0.7, 0.25), 'aura_khoi_huong', 'night: rare index 1');
select is(pg_temp.one('esprits_de_la_nuit', 0.7, 0.9999), 'outfit_ao_khoi', 'night: rare last index');
select is(pg_temp.one('esprits_de_la_nuit', 0.9, 0.0), 'aura_ma_troi', 'night: epic index 0');
select is(pg_temp.one('esprits_de_la_nuit', 0.9, 0.34), 'char_thay_phap', 'night: epic index 1');
select is(pg_temp.one('esprits_de_la_nuit', 0.9, 0.67), 'hat_mat_na_cao', 'night: epic index 2');
select is(pg_temp.one('esprits_de_la_nuit', 0.9999, 0.9999), 'char_ho_ly', 'night: the single legendary');
select is(pg_temp.one('esprits_de_la_nuit', 0.1, 0.0, 39), 'char_ho_ly', 'night: pity 39 forces the legendary');
select is(pg_temp.strays('esprits_de_la_nuit'), 0, 'night: every draw over a 51x51 roll grid is a night item');

-- ---------- draw: legendes_sombres regression (same rolls, same items as 06_gacha_test) ----------
select is(pg_temp.one('legendes_sombres', 0.1, 0.0) || ',' || pg_temp.one('legendes_sombres', 0.1, 0.75) || ',' || pg_temp.one('legendes_sombres', 0.7, 0.5) || ','
  || pg_temp.one('legendes_sombres', 0.9, 0.34) || ',' || pg_temp.one('legendes_sombres', 0.9, 0.67) || ',' || pg_temp.one('legendes_sombres', 0.99, 0.9),
  'acc_giao_tre,outfit_ao_chen,hat_mu_chien,char_kiem_khach,outfit_son_tinh,char_phap_su', 'dark legends: the same rolls draw the same items');
select is(pg_temp.seq(public.gacha_draw('legendes_sombres', '{}', 0, 10, pg_temp.rep(0.1, 0.0, 9) || array[0.1, 0.75]::float8[])),
  'acc_giao_tre,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,hat_thuy_tinh', 'dark legends: the x10 forced rare is unchanged');
select is(pg_temp.one('legendes_sombres', 0.1, 0.0, 39), 'char_phap_su', 'dark legends: pity is unchanged');
select is(pg_temp.strays('legendes_sombres'), 0, 'dark legends: no draw strays into the new themes');

-- ---------- setup: players ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.join_group('FAM', 'Bob', '🐲') $$, 'bob joins');
reset role;
update public.user_stats set coins = 1000, gacha_pity = '{"legendes_sombres": 17, "esprits_de_la_nuit": 5}'
  where user_id = 'a0000000-0000-0000-0000-000000000001';

-- ---------- gacha_pull: seigneur_des_mers x1 ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select set_config('t.r1', public.gacha_pull(gen_random_uuid(), 'seigneur_des_mers', 1)::text, true);
select is((current_setting('t.r1')::json->>'ok') || '/' || (current_setting('t.r1')::json->>'cost') || '/' || json_array_length(current_setting('t.r1')::json->'items'), 'true/40/1', 'sea pull x1: ok, 40 xu, one item');
reset role;
select is(pg_temp.off(current_setting('t.r1')::json, 'seigneur_des_mers'), 0, 'sea pull x1: the item is a sea item');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.coins(), 1000 - 40, 'sea pull x1: 40 xu debited (a first item is never a duplicate)');
select ok((current_setting('t.r1')::json->'items'->0->>'itemId') = any(pg_temp.inv()), 'sea pull x1: the item is in the inventory');
select is(pg_temp.pity('seigneur_des_mers'), case when current_setting('t.r1')::json->'items'->0->>'rarity' = 'legendary' then 0 else 1 end, 'sea pull x1: the sea counter advanced');
select is(pg_temp.pity('legendes_sombres') || '/' || pg_temp.pity('esprits_de_la_nuit'), '17/5', 'sea pull x1: the other themes'' counters are untouched');

-- ---------- gacha_pull: esprits_de_la_nuit x10 ----------
select set_config('t.c2', pg_temp.coins()::text, true);
select set_config('t.s2', pg_temp.pity('seigneur_des_mers')::text, true);
select set_config('t.r2', public.gacha_pull(gen_random_uuid(), 'esprits_de_la_nuit', 10)::text, true);
select is((current_setting('t.r2')::json->>'ok') || '/' || (current_setting('t.r2')::json->>'cost') || '/' || json_array_length(current_setting('t.r2')::json->'items'), 'true/360/10', 'night pull x10: ok, 360 xu, ten items');
reset role;
select is(pg_temp.off(current_setting('t.r2')::json, 'esprits_de_la_nuit'), 0, 'night pull x10: every item is a night item');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.coins(), current_setting('t.c2')::int - 360 + (select sum((e->>'refund')::int)::int from json_array_elements(current_setting('t.r2')::json->'items') e), 'night pull x10: coins = before - 360 + refunds');
select ok(not exists (select 1 from json_array_elements(current_setting('t.r2')::json->'items') e
  where (e->>'duplicate') = 'false' and not ((e->>'itemId') = any(pg_temp.inv()))), 'night pull x10: every new item is in the inventory');
select is(pg_temp.pity('legendes_sombres') || '/' || pg_temp.pity('seigneur_des_mers'), '17/' || current_setting('t.s2'), 'night pull x10: the other themes'' counters are untouched');
select is(pg_temp.pity('esprits_de_la_nuit'), (current_setting('t.r2')::json->>'pity')::int, 'night pull x10: the night counter is the one returned');

-- ---------- gacha_pull: pity forces each theme's own legendary, and resets only that theme ----------
reset role;
update public.user_stats set coins = 1000, inventory = '{}', gacha_pity = '{"legendes_sombres": 39, "seigneur_des_mers": 39, "esprits_de_la_nuit": 39}'
  where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(public.gacha_pull(gen_random_uuid(), 'seigneur_des_mers', 1)->'items'->0->>'itemId', 'acc_kiem_rong', 'sea pity 39: the next sea pull is the dragon sword');
select is(pg_temp.pity('seigneur_des_mers') || '/' || pg_temp.pity('esprits_de_la_nuit') || '/' || pg_temp.pity('legendes_sombres'), '0/39/39', 'only the sea counter resets');
select is(public.gacha_pull(gen_random_uuid(), 'esprits_de_la_nuit', 1)->'items'->0->>'itemId', 'char_ho_ly', 'night pity 39: the next night pull is the nine-tailed fox');
select is(pg_temp.pity('seigneur_des_mers') || '/' || pg_temp.pity('esprits_de_la_nuit') || '/' || pg_temp.pity('legendes_sombres'), '0/0/39', 'only the night counter resets');
select is(pg_temp.coins() || '/' || array_to_string(pg_temp.inv(), ','), '920/acc_kiem_rong,char_ho_ly', 'both legendaries cost 40 each and entered the inventory');

-- ---------- refusals, purchase and equipment of the new items ----------
reset role;
update public.user_stats set coins = 39 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'esprits_de_la_nuit', 1)), 'not_enough', 'new theme: 39 xu is not enough for 40');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'nope', 1)), 'unknown_theme', 'an unknown theme is still refused');
reset role;
update public.user_stats set coins = 1000, inventory = '{}' where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "acc_kiem_rong"}');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "char_ho_ly"}');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "acc_mai_cheo"}');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "outfit_ao_dem"}');
select is(pg_temp.coins() || '/' || cardinality(pg_temp.inv()), '1000/0', 'forged item_purchased of new gacha items changes nothing');
reset role;
update public.user_stats set inventory = '{char_ho_ly,acc_kiem_rong}' where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.ev('item_equipped', 'x', '{"slot": "character", "itemId": "char_ho_ly"}');
select pg_temp.ev('item_equipped', 'x', '{"slot": "accessory", "itemId": "acc_kiem_rong"}');
select pg_temp.ev('item_equipped', 'x', '{"slot": "hat", "itemId": "hat_mu_rong"}');
select is((select (equipped->>'character') || '/' || (equipped->>'accessory') || '/' || coalesce(equipped->>'hat', 'none') from public.user_stats where user_id = auth.uid()),
  'char_ho_ly/acc_kiem_rong/none', 'owned new items equip in their slot; an unowned one does not');
select throws_ok($$ select * from public.shop_items() $$, '42501', null, 'shop_items is still not callable by players');
select throws_ok($$ select * from public.shop_item('char_ho_ly') $$, '42501', null, 'shop_item is still not callable by players');

select * from finish();
rollback;
