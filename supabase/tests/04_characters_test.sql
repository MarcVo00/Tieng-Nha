begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
select is((select coalesce(price::text, 'null') || '/' || kind || '/' || slot from public.shop_item('char_kiem_khach')), 'null/cosmetic/character', 'char_kiem_khach: gacha-only (no price), cosmetic, character');
select is((select coalesce(price::text, 'null') || '/' || kind || '/' || slot from public.shop_item('char_phap_su')), 'null/cosmetic/character', 'char_phap_su: gacha-only (no price), cosmetic, character');

-- ---------- purchase: characters are gacha-only since the gacha migration, so a purchase is always refused ----------
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
reset role;
update public.user_stats set coins = 100 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ev('item_purchased', '{"itemId": "char_kiem_khach"}');
select is(pg_temp.coins(), 100, 'a character is refused when coins are short');
select ok(not ('char_kiem_khach' = any(pg_temp.inv())), 'a refused purchase leaves the inventory unchanged');
reset role;
update public.user_stats set coins = 1000 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ev('item_purchased', '{"itemId": "char_kiem_khach"}');
select is(pg_temp.coins(), 1000, 'char_kiem_khach is refused even with enough coins (gacha-only)');
select ok(not ('char_kiem_khach' = any(pg_temp.inv())), 'char_kiem_khach did not reach the inventory');
-- the player owns the character and the hat (gacha pulls, or purchases made before the gacha migration)
reset role;
update public.user_stats set inventory = '{char_kiem_khach,hat_thuy_tinh}' where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');

-- ---------- equipment ----------
select pg_temp.ev('item_equipped', '{"slot": "character", "itemId": "char_kiem_khach"}');
select is(pg_temp.eq('character'), 'char_kiem_khach', 'an owned character can be equipped');
select ok('hat_thuy_tinh' = any(pg_temp.inv()), 'a real hat is owned');
select pg_temp.ev('item_equipped', '{"slot": "hat", "itemId": "hat_thuy_tinh"}');
select is(pg_temp.eq('hat'), 'hat_thuy_tinh', 'the real hat is equipped');
select pg_temp.ev('item_equipped', '{"slot": "hat", "itemId": "char_kiem_khach"}');
select is(pg_temp.eq('hat'), 'hat_thuy_tinh', 'a character cannot go in the hat slot: the hat stays');
select is(pg_temp.eq('character'), 'char_kiem_khach', 'the character slot is unchanged by the refused hat equip');
select pg_temp.ev('item_equipped', '{"slot": "character", "itemId": null}');
select is(pg_temp.eq('character'), null, 'a null itemId removes the character');

select * from finish();
rollback;
