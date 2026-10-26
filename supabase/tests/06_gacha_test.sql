begin;
create extension if not exists pgtap with schema extensions;
select plan(149);

-- alice (A) and bob (B) pull; the pure rules are tested first, as postgres.
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
create function pg_temp.xp() returns int language sql as $$
  select xp_total from public.user_stats where user_id = auth.uid()
$$;
create function pg_temp.pity(theme text) returns int language sql as $$
  select coalesce((gacha_pity->>theme)::int, 0) from public.user_stats where user_id = auth.uid()
$$;
create function pg_temp.err(j json) returns text language sql as $$ select j->>'error' $$;

-- draw helpers: the whole set of the launch theme, n identical roll pairs, readable summaries
create function pg_temp.d(inv text[], pity int, n int, rolls float8[]) returns jsonb language sql as $$
  select public.gacha_draw('legendes_sombres', inv, pity, n, rolls)
$$;
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
create function pg_temp.refunds(j jsonb) returns int language sql as $$
  select coalesce(sum((e->>'refund')::int), 0)::int from jsonb_array_elements(j->'items') e
$$;
create function pg_temp.full() returns text[] language sql as $$
  select array_agg(id order by id) from public.shop_items() where theme = 'legendes_sombres'
$$;

create function pg_temp.sweep() returns int language plpgsql as $$
declare k int; r json; bad int := 0;
begin
  for k in 1..60 loop
    r := public.gacha_pull(gen_random_uuid(), 'legendes_sombres', case when k % 3 = 0 then 10 else 1 end);
    if r->>'ok' <> 'true' then bad := bad + 1; end if;
    if (r->>'count') = '10' and not exists (select 1 from json_array_elements(r->'items') e where e->>'rarity' <> 'common') then bad := bad + 1; end if;
  end loop;
  return bad;
end $$;

-- ---------- catalogue (as postgres) ----------
select is((select count(*)::int from public.shop_items() where theme = 'legendes_sombres' and rarity is not null and currency = 'xu' and price is null), 12, 'legendes_sombres has 12 gacha items');
select is((select string_agg(rarity || ':' || n, ',' order by rarity) from (
  select rarity, count(*) n from public.shop_items() where theme = 'legendes_sombres' group by rarity) q), 'common:4,epic:3,legendary:1,rare:4', 'rarities: 4 common, 4 rare, 3 epic, 1 legendary');
select is((select string_agg(id, ',' order by id) from public.shop_items() where rarity = 'common'), 'acc_giao_tre,aura_suong_mu,hat_khan_vanh,outfit_ao_chen', 'the common items');
select is((select string_agg(id, ',' order by id) from public.shop_items() where rarity = 'rare'), 'acc_quat_sat,aura_waves,hat_mu_chien,hat_thuy_tinh', 'the rare items');
select is((select string_agg(id, ',' order by id) from public.shop_items() where rarity = 'epic'), 'acc_thuan_thien,char_kiem_khach,outfit_son_tinh', 'the epic items');
select is((select string_agg(id, ',') from public.shop_items() where rarity = 'legendary'), 'char_phap_su', 'the legendary item');
select is((select count(*)::int from public.shop_items() where rarity is not null and (price is not null or currency <> 'xu' or theme is null)), 0, 'every rarity item is an xu cosmetic with a theme and no price');
select is((select count(*)::int from public.shop_items() where theme = 'arene' and (rarity is not null or currency <> 'kim_bai' or price is null)), 0, 'arena items are unchanged (Kim bai, priced, no rarity)');
select is((select count(*)::int from public.shop_items() where kind = 'consumable' and (rarity is not null or theme is not null or price is null)), 0, 'consumables are unchanged');
select is((select count(*)::int from public.shop_items() where slot in ('frame', 'profile_fx') and (rarity is not null or price is not null)), 0, 'frames and fx are unchanged');
select is((select price from public.shop_item('hat_thuy_tinh')), null::int, 'hat_thuy_tinh is no longer for sale');
select is((select rarity || '/' || theme || '/' || slot from public.shop_item('char_kiem_khach')), 'epic/legendes_sombres/character', 'shop_item exposes rarity and theme');
select is((select price || '/' || currency from public.shop_item('energy_refill')), '30/xu', 'energy_refill is unchanged');
select is(public.gacha_cost(1) || '/' || public.gacha_cost(10), '40/360', 'prices: 1 pull 40 xu, 10 pulls 360 xu');
select is(public.gacha_cost(2), null::int, 'any other count has no price');
select is(public.gacha_refund('common') || '/' || public.gacha_refund('rare') || '/' || public.gacha_refund('epic') || '/' || public.gacha_refund('legendary'), '8/20/50/120', 'duplicate refunds 8/20/50/120');

-- ---------- pure rules: rarity thresholds 0.60 / 0.88 / 0.98 ----------
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.0, 0.0]::float8[])), 'acc_giao_tre', 'roll 0 is the first common');
select is(pg_temp.rar(pg_temp.d('{}', 0, 1, array[0.5999, 0.0]::float8[])), 'c', 'roll 0.5999 is common');
select is(pg_temp.rar(pg_temp.d('{}', 0, 1, array[0.6, 0.0]::float8[])), 'r', 'roll 0.60 is rare');
select is(pg_temp.rar(pg_temp.d('{}', 0, 1, array[0.8799, 0.0]::float8[])), 'r', 'roll 0.8799 is rare');
select is(pg_temp.rar(pg_temp.d('{}', 0, 1, array[0.88, 0.0]::float8[])), 'e', 'roll 0.88 is epic');
select is(pg_temp.rar(pg_temp.d('{}', 0, 1, array[0.9799, 0.0]::float8[])), 'e', 'roll 0.9799 is epic');
select is(pg_temp.rar(pg_temp.d('{}', 0, 1, array[0.98, 0.0]::float8[])), 'l', 'roll 0.98 is legendary');
select is(pg_temp.rar(pg_temp.d('{}', 0, 1, array[0.9999, 0.99]::float8[])), 'l', 'roll 0.9999 is legendary');

-- ---------- pure rules: item pick = floor(r2 * n) among the rarity, sorted by id ----------
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.1, 0.24]::float8[])), 'acc_giao_tre', 'common r2 0.24 -> index 0');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.1, 0.25]::float8[])), 'aura_suong_mu', 'common r2 0.25 -> index 1');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.1, 0.5]::float8[])), 'hat_khan_vanh', 'common r2 0.5 -> index 2');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.1, 0.75]::float8[])), 'outfit_ao_chen', 'common r2 0.75 -> index 3');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.1, 0.9999]::float8[])), 'outfit_ao_chen', 'common r2 0.9999 -> last index');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.7, 0.5]::float8[])), 'hat_mu_chien', 'rare r2 0.5 -> index 2');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.9, 0.3333]::float8[])), 'acc_thuan_thien', 'epic r2 0.3333 -> index 0');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.9, 0.34]::float8[])), 'char_kiem_khach', 'epic r2 0.34 -> index 1');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.9, 0.67]::float8[])), 'outfit_son_tinh', 'epic r2 0.67 -> index 2');
select is(pg_temp.seq(pg_temp.d('{}', 0, 1, array[0.99, 0.9]::float8[])), 'char_phap_su', 'the single legendary');

-- ---------- pure rules: pity (counter advances by 1 per item; the 40th item without a legendary is legendary) ----------
select is(pg_temp.seq(pg_temp.d('{}', 38, 1, array[0.1, 0.0]::float8[])) || '/' || (pg_temp.d('{}', 38, 1, array[0.1, 0.0]::float8[])->>'pity'), 'acc_giao_tre/39', 'pity 38: the 39th item is not forced, counter 39');
select is(pg_temp.rar(pg_temp.d('{}', 39, 1, array[0.1, 0.0]::float8[])) || '/' || (pg_temp.d('{}', 39, 1, array[0.1, 0.0]::float8[])->>'pity'), 'l/0', 'pity 39: the 40th item is forced legendary, counter resets');
select is(pg_temp.rar(pg_temp.d('{}', 41, 1, array[0.1, 0.0]::float8[])), 'l', 'a counter past 40 is still forced');
select is(pg_temp.d('{}', 0, 3, pg_temp.rep(0.1, 0.0, 3))->>'pity', '3', 'three commons advance the counter by 3');
select is(pg_temp.d('{}', 10, 1, array[0.99, 0.0]::float8[])->>'pity', '0', 'any legendary resets the counter');
select is(pg_temp.rar(pg_temp.d('{}', 35, 10, pg_temp.rep(0.1, 0.0, 10))) || '/' || (pg_temp.d('{}', 35, 10, pg_temp.rep(0.1, 0.0, 10))->>'pity'), 'cccclccccc/5', 'x10 from 35: the 5th item is the 40th, then 5 more commons');
select is(pg_temp.rar(pg_temp.d('{}', 30, 10, pg_temp.rep(0.1, 0.0, 10))), 'cccccccccl', 'x10 from 30: the 10th item is the 40th: legendary (not merely rare)');
select is(pg_temp.rar(pg_temp.d('{}', 0, 10, pg_temp.rep(0.99, 0.0, 10))), 'llllllllll', 'ten legendary rolls: ten legendaries');

-- ---------- pure rules: x10 guarantee ----------
select is(pg_temp.rar(pg_temp.d('{}', 0, 10, pg_temp.rep(0.1, 0.0, 10))), 'cccccccccr', 'x10: nine commons force the 10th to rare');
select is(pg_temp.seq(pg_temp.d('{}', 0, 10, pg_temp.rep(0.1, 0.0, 9) || array[0.1, 0.75]::float8[])), 'acc_giao_tre,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,acc_giao_tre*,hat_thuy_tinh', 'x10: the forced rare is picked with the second roll; same-pull repeats are duplicates');
select is(pg_temp.rar(pg_temp.d('{}', 0, 10, pg_temp.rep(0.1, 0.0, 9) || array[0.95, 0.0]::float8[])), 'ccccccccce', 'x10: an epic 10th stays epic');
select is(pg_temp.rar(pg_temp.d('{}', 0, 10, array[0.7, 0.0]::float8[] || pg_temp.rep(0.1, 0.0, 9))), 'rccccccccc', 'x10: a rare among the first nine leaves the 10th common');
select is(pg_temp.rar(pg_temp.d('{}', 0, 1, array[0.1, 0.0]::float8[])), 'c', 'a single pull has no guarantee');
select is(pg_temp.rar(pg_temp.d('{}', 0, 3, pg_temp.rep(0.1, 0.0, 3))), 'ccc', 'only a x10 has the rare guarantee');

-- ---------- pure rules: duplicates and refunds ----------
select is(pg_temp.seq(pg_temp.d('{acc_giao_tre}', 0, 1, array[0.1, 0.0]::float8[])) || '/' || pg_temp.refunds(pg_temp.d('{acc_giao_tre}', 0, 1, array[0.1, 0.0]::float8[])), 'acc_giao_tre*/8', 'an owned common refunds 8');
select is(pg_temp.refunds(pg_temp.d('{aura_waves}', 0, 1, array[0.7, 0.25]::float8[])), 20, 'an owned rare refunds 20');
select is(pg_temp.refunds(pg_temp.d('{acc_thuan_thien}', 0, 1, array[0.9, 0.0]::float8[])), 50, 'an owned epic refunds 50');
select is(pg_temp.refunds(pg_temp.d('{char_phap_su}', 0, 1, array[0.99, 0.0]::float8[])), 120, 'an owned legendary refunds 120');
select is(pg_temp.refunds(pg_temp.d('{}', 0, 1, array[0.1, 0.0]::float8[])), 0, 'a new item refunds nothing');
select is(pg_temp.refunds(pg_temp.d('{}', 0, 10, pg_temp.rep(0.1, 0.0, 9) || array[0.1, 0.75]::float8[])), 64, 'in-pull duplicates refund too: 8 x 8 (the rare is new)');
select is(pg_temp.refunds(pg_temp.d(pg_temp.full(), 0, 10, pg_temp.rep(0.1, 0.0, 10))), 92, 'a complete set: all ten are duplicates, 9 x 8 + 20 (forced rare)');
select is(pg_temp.seq(pg_temp.d(pg_temp.full(), 0, 1, array[0.99, 0.0]::float8[])), 'char_phap_su*', 'a complete set can still be pulled; the item is a duplicate');
select is(pg_temp.d('{}', 0, 2, array[0.1, 0.0, 0.1, 0.0]::float8[])->'items', pg_temp.d('{}', 0, 2, array[0.1, 0.0, 0.1, 0.0, 0.9, 0.9]::float8[])->'items', 'extra rolls are ignored');
select is(pg_temp.d(null, null, 1, array[0.1, 0.0]::float8[])->>'pity', '1', 'null inventory and null pity are empty / 0');
select throws_ok($$ select pg_temp.d('{}', 0, 2, array[0.1, 0.0]::float8[]) $$, 'P0001', null, 'too few rolls raise (internal function)');
select throws_ok($$ select pg_temp.d('{}', 0, 1, array[0.1, null]::float8[]) $$, 'P0001', null, 'a null roll raises (internal function)');

-- ---------- pure rules: a rarity missing from the theme steps down (then up) ----------
-- Test-only catalogue: wrap shop_items() with two fake themes (rolled back with the transaction).
alter function public.shop_items() rename to shop_items_real;
create function public.shop_items() returns table(id text, price int, kind text, slot text, currency text, theme text, rarity text)
language sql stable as $$
  select * from public.shop_items_real()
  union all select * from (values
    ('t_c1', null::int, 'cosmetic', 'hat', 'xu', 'only_ce', 'common'),
    ('t_e1', null::int, 'cosmetic', 'hat', 'xu', 'only_ce', 'epic'),
    ('u_e1', null::int, 'cosmetic', 'hat', 'xu', 'only_e', 'epic')
  ) f(id, price, kind, slot, currency, theme, rarity)
$$;
select is(pg_temp.seq(public.gacha_draw('only_ce', '{}', 0, 1, array[0.7, 0.0]::float8[])) || '/' || pg_temp.rar(public.gacha_draw('only_ce', '{}', 0, 1, array[0.7, 0.0]::float8[])), 't_c1/c', 'no rare: step down to common');
select is(pg_temp.seq(public.gacha_draw('only_ce', '{}', 0, 1, array[0.99, 0.0]::float8[])) || '/' || pg_temp.rar(public.gacha_draw('only_ce', '{}', 0, 1, array[0.99, 0.0]::float8[])), 't_e1/e', 'no legendary: step down to the next lower rarity that has items (epic)');
select is(pg_temp.rar(public.gacha_draw('only_ce', '{}', 0, 1, array[0.9, 0.0]::float8[])), 'e', 'epic is available: no fallback');
select is(pg_temp.rar(public.gacha_draw('only_e', '{}', 0, 1, array[0.1, 0.0]::float8[])), 'e', 'nothing below: step up to the nearest higher rarity');
select is(public.gacha_draw('only_ce', '{}', 39, 1, array[0.1, 0.0]::float8[])->>'pity', '40', 'a forced legendary that falls back to epic does not reset the counter');
select is(pg_temp.rar(public.gacha_draw('only_ce', '{}', 0, 10, pg_temp.rep(0.1, 0.0, 10))), 'cccccccccc', 'x10 rule with no rare: the forced rare falls back to common');
select throws_ok($$ select public.gacha_draw('arene', '{}', 0, 1, array[0.1, 0.0]::float8[]) $$, 'P0001', null, 'a theme without gacha items raises (internal function)');
drop function public.shop_items();
alter function public.shop_items_real() rename to shop_items;
select is((select count(*)::int from public.shop_items()), 23, 'the real catalogue is restored');

-- ---------- setup: players ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.join_group('FAM', 'Bob', '🐲') $$, 'bob joins');
reset role;
update public.user_stats set coins = 1000 where user_id in ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');

-- ---------- gacha_pull: refusals change nothing ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.gacha_pull(null, 'legendes_sombres', 1)), 'bad_pull', 'pull: null id');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 2)), 'bad_count', 'pull: count 2');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 0)), 'bad_count', 'pull: count 0');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 11)), 'bad_count', 'pull: count 11');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'legendes_sombres', null)), 'bad_count', 'pull: null count');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'nope', 1)), 'unknown_theme', 'pull: unknown theme');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'arene', 1)), 'unknown_theme', 'pull: the arena is not a gacha theme');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), null, 1)), 'unknown_theme', 'pull: null theme');
reset role;
update public.user_stats set coins = 39 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 1)), 'not_enough', 'pull: 39 xu is not enough for 40');
reset role;
update public.user_stats set coins = 359 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 10)), 'not_enough', 'pull: 359 xu is not enough for 360');
select is(pg_temp.coins() || '/' || cardinality(pg_temp.inv()) || '/' || pg_temp.pity('legendes_sombres'), '359/0/0', 'refusals changed nothing (xu, inventory, pity)');
reset role;
select is((select count(*)::int from public.gacha_pulls), 0, 'refusals stored no pull');

-- ---------- gacha_pull: one pull, idempotency ----------
update public.user_stats set coins = 1000 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select set_config('t.p1', gen_random_uuid()::text, true);
select set_config('t.r1', public.gacha_pull(current_setting('t.p1')::uuid, 'legendes_sombres', 1)::text, true);
select is(current_setting('t.r1')::json->>'ok', 'true', 'pull x1: ok');
select is((current_setting('t.r1')::json->>'cost') || '/' || (current_setting('t.r1')::json->>'count') || '/' || json_array_length(current_setting('t.r1')::json->'items'), '40/1/1', 'pull x1: costs 40, one item');
select is(pg_temp.coins(), 1000 - 40 + (current_setting('t.r1')::json->'items'->0->>'refund')::int, 'pull x1: coins = 1000 - 40 + refund');
select is((current_setting('t.r1')::json->>'coins')::int, pg_temp.coins(), 'pull x1: the response carries the new balance');
select ok((current_setting('t.r1')::json->'items'->0->>'itemId') = any(pg_temp.inv()), 'pull x1: the item is in the inventory');
select is((current_setting('t.r1')::json->'items'->0->>'duplicate'), 'false', 'pull x1: the first item is new');
select is(pg_temp.pity('legendes_sombres') + 0, case when current_setting('t.r1')::json->'items'->0->>'rarity' = 'legendary' then 0 else 1 end, 'pull x1: the pity counter advanced');
select set_config('t.c1', pg_temp.coins()::text, true);
select is(public.gacha_pull(current_setting('t.p1')::uuid, 'legendes_sombres', 1)::jsonb - 'replayed' - 'pity' - 'coins',
          current_setting('t.r1')::jsonb - 'replayed' - 'pity' - 'coins', 'replay: the same pull id returns the stored result');
select is(public.gacha_pull(current_setting('t.p1')::uuid, 'legendes_sombres', 1)->>'replayed', 'true', 'replay: flagged as replayed');
select is(pg_temp.coins(), current_setting('t.c1')::int, 'replay: no second debit');
select is(public.gacha_pull(current_setting('t.p1')::uuid, 'legendes_sombres', 10)->>'count', '1', 'replay with other parameters still returns the stored pull');
select is(pg_temp.coins(), current_setting('t.c1')::int, 'replay with other parameters: no debit');
reset role;
select is((select count(*)::int from public.gacha_pulls where id = current_setting('t.p1')::uuid and claimed = false and cost = 40), 1, 'exactly one stored pull, unclaimed');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is(pg_temp.err(public.gacha_pull(current_setting('t.p1')::uuid, 'legendes_sombres', 1)), 'bad_pull', 'another player cannot reuse (or read) a pull id');
select is(pg_temp.coins(), 1000, 'bob was not debited');

-- ---------- gacha_pull: x10 and conservation of xu ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select set_config('t.p2', gen_random_uuid()::text, true);
select set_config('t.c2', pg_temp.coins()::text, true);
select set_config('t.r2', public.gacha_pull(current_setting('t.p2')::uuid, 'legendes_sombres', 10)::text, true);
select is(json_array_length(current_setting('t.r2')::json->'items') || '/' || (current_setting('t.r2')::json->>'cost'), '10/360', 'pull x10: ten items for 360');
select is(pg_temp.coins(), current_setting('t.c2')::int - 360 + (select sum((e->>'refund')::int)::int from json_array_elements(current_setting('t.r2')::json->'items') e), 'pull x10: coins = before - 360 + refunds');
select ok(not exists (select 1 from json_array_elements(current_setting('t.r2')::json->'items') e
  where (e->>'duplicate') = 'false' and not ((e->>'itemId') = any(pg_temp.inv()))), 'pull x10: every new item is in the inventory');
select is((select count(*)::int from (select x from unnest(pg_temp.inv()) x group by x having count(*) > 1) d), 0, 'the inventory has no repeated item');
select ok((select count(*) from json_array_elements(current_setting('t.r2')::json->'items') e where e->>'rarity' <> 'common') >= 1, 'pull x10: at least one rare or better');

-- ---------- gacha_pull: pity, forced legendary ----------
reset role;
update public.user_stats set coins = 1000, inventory = '{}', gacha_pity = '{"legendes_sombres": 39}'
  where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select set_config('t.r3', public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 1)::text, true);
select is(current_setting('t.r3')::json->'items'->0->>'itemId', 'char_phap_su', 'pity 39: the next pull is the legendary');
select is(pg_temp.pity('legendes_sombres'), 0, 'pity: reset after the legendary');
select is(pg_temp.coins() || '/' || cardinality(pg_temp.inv()), '960/1', 'pity: the legendary cost 40 and entered the inventory');
select set_config('t.r4', public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 1)::text, true);
select ok(pg_temp.pity('legendes_sombres') in (0, 1), 'pity: counts again from 0');
reset role;
update public.user_stats set gacha_pity = '{"legendes_sombres": 39, "autre": 7}' where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select set_config('t.r5', public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 10)::text, true);
select is(current_setting('t.r5')::json->'items'->0->>'itemId', 'char_phap_su', 'pity 39 then x10: the first item is the legendary');
select is(current_setting('t.r5')::json->'items'->0->>'duplicate', 'true', 'it is a duplicate of the owned legendary');
select is((select (gacha_pity->>'autre')::int from public.user_stats where user_id = auth.uid()), 7, 'the pity of another theme is untouched');

-- ---------- gacha_pull: complete set ----------
reset role;
update public.user_stats set coins = 1000, inventory = pg_temp.full(), gacha_pity = '{}' where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select set_config('t.r6', public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 10)::text, true);
select is(current_setting('t.r6')::json->>'ok', 'true', 'complete set: the pull is accepted');
select is((select count(*)::int from json_array_elements(current_setting('t.r6')::json->'items') e where e->>'duplicate' = 'true' and (e->>'refund')::int > 0), 10, 'complete set: all ten items are refunded duplicates');
select is(pg_temp.coins(), 1000 - 360 + (select sum((e->>'refund')::int)::int from json_array_elements(current_setting('t.r6')::json->'items') e), 'complete set: coins = before - 360 + refunds');
select is(cardinality(pg_temp.inv()), 12, 'complete set: the inventory is unchanged');

-- ---------- sweep: xu are conserved over many random pulls ----------
reset role;
update public.user_stats set coins = 100000, inventory = '{}', gacha_pity = '{}' where user_id = 'b0000000-0000-0000-0000-000000000002';
delete from public.gacha_pulls where user_id = 'b0000000-0000-0000-0000-000000000002';
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is(pg_temp.sweep(), 0, 'sweep: 60 pulls all ok, every x10 had a rare or better');
reset role;
select is((select 100000 - sum(cost) + (select sum((e->>'refund')::int) from public.gacha_pulls p2, jsonb_array_elements(p2.results) e where p2.user_id = 'b0000000-0000-0000-0000-000000000002')
  from public.gacha_pulls where user_id = 'b0000000-0000-0000-0000-000000000002')::int,
  (select coins from public.user_stats where user_id = 'b0000000-0000-0000-0000-000000000002'), 'sweep: the stored pulls explain the balance exactly');
select is((select count(*)::int from (select x from unnest((select inventory from public.user_stats where user_id = 'b0000000-0000-0000-0000-000000000002')) x group by x having count(*) > 1) d), 0, 'sweep: no repeated item in the inventory');
select ok((select coins from public.user_stats where user_id = 'b0000000-0000-0000-0000-000000000002') > 0, 'sweep: the balance stays positive');

-- ---------- event gacha_pulled: marks claimed, nothing else ----------
update public.user_stats set coins = 1000, inventory = '{}', gacha_pity = '{}' where user_id = 'a0000000-0000-0000-0000-000000000001';
delete from public.gacha_pulls where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select set_config('t.e1', gen_random_uuid()::text, true);
select set_config('t.e2', gen_random_uuid()::text, true);
select public.gacha_pull(current_setting('t.e1')::uuid, 'legendes_sombres', 1);
select public.gacha_pull(current_setting('t.e2')::uuid, 'legendes_sombres', 1);
select set_config('t.snap', pg_temp.coins() || '/' || array_to_string(pg_temp.inv(), ',') || '/' || pg_temp.pity('legendes_sombres') || '/' || pg_temp.xp(), true);
select is(json_array_length(public.list_gacha_pulls()), 2, 'list: both pulls are listed');
select is((select count(*)::int from json_array_elements(public.list_gacha_pulls()) e where e->>'claimed' = 'false'), 2, 'list: both are unclaimed');
select pg_temp.ev('gacha_pulled', current_setting('t.e1'), '{"theme":"legendes_sombres","cost":999,"items":[{"itemId":"char_phap_su","rarity":"legendary","duplicate":false,"refund":9999}]}', 50);
select is(pg_temp.coins() || '/' || array_to_string(pg_temp.inv(), ',') || '/' || pg_temp.pity('legendes_sombres') || '/' || pg_temp.xp(), current_setting('t.snap'), 'gacha_pulled changes no xu, inventory, pity or XP (client payload and xp ignored)');
select is((public.list_gacha_pulls())->0->>'id', current_setting('t.e2'), 'list: the unclaimed pull comes first');
select is((public.list_gacha_pulls())->1->>'claimed', 'true', 'list: the claimed pull comes last, flagged');
select is((select count(*)::int from json_array_elements(public.list_gacha_pulls()) e where e->>'claimed' = 'true' and e->>'id' = current_setting('t.e1')), 1, 'the event marked its own pull as claimed');
select pg_temp.ev('gacha_pulled', current_setting('t.e1'));
select is(pg_temp.coins() || '/' || array_to_string(pg_temp.inv(), ',') || '/' || pg_temp.pity('legendes_sombres') || '/' || pg_temp.xp(), current_setting('t.snap'), 'a second event for the same pull changes nothing');
select pg_temp.ev('gacha_pulled', 'not-a-uuid');
select pg_temp.ev('gacha_pulled', gen_random_uuid()::text);
select is(pg_temp.coins() || '/' || array_to_string(pg_temp.inv(), ',') || '/' || pg_temp.pity('legendes_sombres') || '/' || pg_temp.xp(), current_setting('t.snap'), 'garbage or unknown pull ids do nothing and never raise');
select is((select count(*)::int from json_array_elements(public.list_gacha_pulls()) e where e->>'claimed' = 'false'), 1, 'one pull is still unclaimed');
-- a player cannot claim someone else's pull
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 1);
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.ev('gacha_pulled', current_setting('t.e2'));
select is((select count(*)::int from json_array_elements(public.list_gacha_pulls()) e where e->>'claimed' = 'true'), 2, 'alice claims her second pull');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
reset role;
select set_config('t.bobpull', (select id::text from public.gacha_pulls where user_id = 'b0000000-0000-0000-0000-000000000002' order by created_at desc, id limit 1), true);
update public.gacha_pulls set claimed = false where id = current_setting('t.bobpull')::uuid;
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.ev('gacha_pulled', current_setting('t.bobpull'));
reset role;
select is((select claimed from public.gacha_pulls where id = current_setting('t.bobpull')::uuid), false, 'alice cannot claim bob''s pull');

-- ---------- list_gacha_pulls: own only, all unclaimed, 20 latest claimed ----------
delete from public.gacha_pulls where user_id = 'b0000000-0000-0000-0000-000000000002';
insert into public.gacha_pulls (id, user_id, theme, count, cost, results, created_at, claimed)
select gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'legendes_sombres', 1, 40, '[]', now() - (i || ' days')::interval, true
from generate_series(1, 25) i;
update public.gacha_pulls set claimed = false where user_id = 'b0000000-0000-0000-0000-000000000002' and id in (
  select id from public.gacha_pulls where user_id = 'b0000000-0000-0000-0000-000000000002' order by created_at limit 3);
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from json_array_elements(public.list_gacha_pulls()) e where e->>'claimed' = 'false'), 3, 'list: no unclaimed pull is ever omitted');
select is((select count(*)::int from json_array_elements(public.list_gacha_pulls()) e where e->>'claimed' = 'true'), 20, 'list: at most the 20 latest claimed pulls');
select is((select e->>'claimed' from json_array_elements(public.list_gacha_pulls()) e limit 1), 'false', 'list: unclaimed first');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from json_array_elements(public.list_gacha_pulls()) e where e->>'theme' = 'legendes_sombres'), 2, 'list: alice sees only her own pulls');
select ok((public.list_gacha_pulls())->0->'items'->0->>'itemId' is not null, 'list: items carry itemId');

-- ---------- direct purchase of a gacha item is refused ----------
reset role;
update public.user_stats set coins = 1000, inventory = '{}' where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "char_phap_su"}');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "hat_thuy_tinh"}');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "acc_giao_tre"}');
select is(pg_temp.coins() || '/' || cardinality(pg_temp.inv()), '1000/0', 'forged item_purchased of gacha items (old and new) changes nothing');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "energy_refill"}');
select is(pg_temp.coins(), 970, 'consumables are still bought directly');
select pg_temp.ev('item_equipped', 'x', '{"slot": "hat", "itemId": "hat_thuy_tinh"}');
select is((select equipped->>'hat' from public.user_stats where user_id = auth.uid()), null, 'an unowned gacha item cannot be equipped');

-- ---------- RLS and grants ----------
select throws_ok($$ select count(*) from public.gacha_pulls $$, '42501', null, 'a player cannot select pulls directly');
select throws_ok($$ insert into public.gacha_pulls (id, user_id, theme, count, cost, results)
  values (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'legendes_sombres', 1, 0, '[]') $$, '42501', null, 'a player cannot insert a pull');
select throws_ok($$ update public.gacha_pulls set claimed = true $$, '42501', null, 'a player cannot update pulls');
select throws_ok($$ truncate public.gacha_pulls $$, '42501', null, 'a player cannot truncate pulls');
select throws_ok($$ select public.gacha_draw('legendes_sombres', '{}', 0, 1, array[0.1, 0.1]::float8[]) $$, '42501', null, 'gacha_draw is not callable by players');
select throws_ok($$ select * from public.shop_items() $$, '42501', null, 'shop_items is not callable by players');
select throws_ok($$ select * from public.shop_item('char_phap_su') $$, '42501', null, 'shop_item is not callable by players');
select throws_ok($$ select public.gacha_cost(1) $$, '42501', null, 'gacha_cost is not callable by players');
select set_config('role', 'anon', true);
select throws_ok($$ select public.gacha_pull(gen_random_uuid(), 'legendes_sombres', 1) $$, '42501', null, 'anon cannot pull');
select throws_ok($$ select public.list_gacha_pulls() $$, '42501', null, 'anon cannot list pulls');
reset role;
select ok(has_function_privilege('authenticated', 'public.gacha_pull(uuid,text,int)', 'execute') and has_function_privilege('authenticated', 'public.list_gacha_pulls()', 'execute'), 'authenticated may call gacha_pull and list_gacha_pulls');
select ok(not has_function_privilege('anon', 'public.gacha_pull(uuid,text,int)', 'execute'), 'anon may not call gacha_pull');
select ok((select relrowsecurity from pg_class where oid = 'public.gacha_pulls'::regclass), 'RLS is on for gacha_pulls');

select * from finish();
rollback;
