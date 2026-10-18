begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- fixtures (as postgres)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.fr'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.fr'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.fr'),
  ('44444444-4444-4444-4444-444444444444', 'dave@test.fr'),
  ('55555555-5555-5555-5555-555555555555', 'erin@test.fr');
insert into public.groups (id, name, invite_code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- inserts one event for the logged-in user
create function pg_temp.ev(t text, p jsonb default '{}', ts timestamptz default now(), r text default 'x') returns void
language sql as $$
  insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), t, r,
    case when t in ('lesson_completed','dialogue_completed','review_session_completed','badge_unlocked') then 10 else 0 end,
    p, ts)
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

-- ---------- catalogue and reward map (as postgres) ----------
select is((select price from public.shop_item('frame_jade')), null::int, 'frame_jade has no price');
select is((select kind from public.shop_item('frame_jade')), 'cosmetic', 'frame_jade is cosmetic');
select is((select slot from public.shop_item('frame_jade')), 'frame', 'frame_jade goes in the frame slot');
select is((select slot from public.shop_item('fx_embers')), 'profile_fx', 'fx_embers goes in the profile_fx slot');
select is((select price from public.shop_item('energy_refill')), 30, 'energy_refill still costs 30');
select is((select price from public.shop_item('streak_freeze')), 50, 'streak_freeze still costs 50');
select is(public.badge_reward('streak_7'), 'frame_bronze', 'streak_7 rewards frame_bronze');
select is(public.badge_reward('perfect_5'), 'fx_ink', 'perfect_5 rewards fx_ink');
select is(public.badge_reward('first_lesson'), null::text, 'first_lesson has no reward');

-- ---------- alice: purchase, badge reward, equipment ----------
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
reset role;
update public.user_stats set coins = 500 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');

select pg_temp.ev('item_purchased', '{"itemId": "frame_bronze"}');
select is(pg_temp.coins(), 500, 'a reward-only frame cannot be bought: coins unchanged');
select is(cardinality(pg_temp.inv()), 0, 'a reward-only frame cannot be bought: inventory unchanged');

select pg_temp.ev('badge_unlocked', '{}', now(), 'streak_7');
select is(pg_temp.coins(), 510, 'first streak_7 credits 10');
select ok('frame_bronze' = any(pg_temp.inv()), 'streak_7 adds frame_bronze to the inventory');
select pg_temp.ev('badge_unlocked', '{}', now(), 'streak_7');
select is(pg_temp.coins(), 510, 'second streak_7 credits nothing');
select is(cardinality(pg_temp.inv()), 1, 'second streak_7 leaves the inventory as is');

select pg_temp.ev('item_equipped', '{"slot": "frame", "itemId": "frame_bronze"}');
select is(pg_temp.eq('frame'), 'frame_bronze', 'the reward frame can be equipped');
select pg_temp.ev('item_equipped', '{"slot": "profile_fx", "itemId": "frame_bronze"}');
select is(pg_temp.eq('profile_fx'), null, 'a frame cannot go in the profile_fx slot');
select pg_temp.ev('item_equipped', '{"slot": "profile_fx", "itemId": "fx_ink"}');
select is(pg_temp.eq('profile_fx'), null, 'an unowned effect cannot be equipped');

select pg_temp.ev('badge_unlocked', '{}', now(), 'perfect_5');
select ok('fx_ink' = any(pg_temp.inv()), 'perfect_5 adds fx_ink to the inventory');
select pg_temp.ev('item_equipped', '{"slot": "profile_fx", "itemId": "fx_ink"}');
select is(pg_temp.eq('profile_fx'), 'fx_ink', 'the reward effect can be equipped');
select pg_temp.ev('item_equipped', '{"slot": "frame", "itemId": "fx_ink"}');
select is(pg_temp.eq('frame'), 'frame_bronze', 'an effect cannot go in the frame slot');
select is((select equipped->'frame' from public.leaderboard where user_id = auth.uid()), '"frame_bronze"'::jsonb, 'leaderboard exposes equipped');
select pg_temp.ev('badge_unlocked', '{}', now(), 'first_lesson');
select is(cardinality(pg_temp.inv()), 2, 'a badge without reward leaves the inventory as is');

select lives_ok($$ insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at) values
  (gen_random_uuid(), auth.uid(), 'item_equipped', 'x', 0, '{"slot": "frame", "itemId": 42}', now()),
  (gen_random_uuid(), auth.uid(), 'item_equipped', 'x', 0, '{"itemId": "fx_ink"}', now()),
  (gen_random_uuid(), auth.uid(), 'item_equipped', 'x', 0, '{"slot": 7, "itemId": "fx_ink"}', now()),
  (gen_random_uuid(), auth.uid(), 'item_purchased', 'x', 0, '{"itemId": 42}', now()) $$,
  'malformed equip and purchase payloads do not raise');
select is(pg_temp.eq('frame'), 'frame_bronze', 'malformed payloads leave the frame as is');
select is(pg_temp.eq('profile_fx'), 'fx_ink', 'malformed payloads leave the effect as is');

select pg_temp.ev('item_equipped', '{"slot": "profile_fx", "itemId": null}');
select ok(not ((select equipped from public.user_stats where user_id = auth.uid()) ? 'profile_fx'), 'itemId null removes the profile_fx key');

-- ---------- back-fill (as postgres) ----------
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select public.join_group('FAM', 'Bob', '🐯');
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select public.join_group('FAM', 'Carol', '🐼');
select pg_temp.login('44444444-4444-4444-4444-444444444444');
select public.join_group('FAM', 'Dave', '🦊');
select pg_temp.login('55555555-5555-5555-5555-555555555555');
select public.join_group('FAM', 'Erin', '🐸');
reset role;

alter table public.events disable trigger events_apply;
-- bob (a): bought, equipped, then earned the badge
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at) values
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'item_purchased', 'x', 0, '{"itemId": "frame_bronze"}', now() - interval '3 days'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'item_equipped', 'x', 0, '{"slot": "frame", "itemId": "frame_bronze"}', now() - interval '2 days'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'badge_unlocked', 'streak_7', 10, '{}', now() - interval '1 day');
-- carol (b): badge first, then bought and equipped
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at) values
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'badge_unlocked', 'streak_7', 10, '{}', now() - interval '3 days'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'item_purchased', 'x', 0, '{"itemId": "frame_bronze"}', now() - interval '2 days'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'item_equipped', 'x', 0, '{"slot": "frame", "itemId": "frame_bronze"}', now() - interval '1 day');
-- dave (c): bought and equipped, never earned the badge
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at) values
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'item_purchased', 'x', 0, '{"itemId": "frame_bronze"}', now() - interval '2 days'),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'item_equipped', 'x', 0, '{"slot": "frame", "itemId": "frame_bronze"}', now() - interval '1 day');
-- erin (d): earned exam_excellent, bought nothing
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at) values
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'badge_unlocked', 'exam_excellent', 10, '{}', now() - interval '1 day');
alter table public.events enable trigger events_apply;

-- state produced by the OLD rules
update public.user_stats set coins = 0, inventory = '{frame_bronze}', badges = '{streak_7}', equipped = '{"frame": "frame_bronze"}'
  where user_id in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
update public.user_stats set coins = 0, inventory = '{frame_bronze}', badges = '{}', equipped = '{"frame": "frame_bronze"}'
  where user_id = '44444444-4444-4444-4444-444444444444';
update public.user_stats set coins = 7, inventory = '{}', badges = '{exam_excellent}', equipped = '{}'
  where user_id = '55555555-5555-5555-5555-555555555555';

select lives_ok($$ select public.rewards_backfill() $$, 'rewards_backfill runs');

select is((select coins from public.user_stats where user_id = '22222222-2222-2222-2222-222222222222'), 40, 'a: refunded 40');
select is((select inventory from public.user_stats where user_id = '22222222-2222-2222-2222-222222222222'), '{frame_bronze}'::text[], 'a: frame_bronze kept as a reward');
select is((select equipped from public.user_stats where user_id = '22222222-2222-2222-2222-222222222222'), '{}'::jsonb, 'a: equip before the badge does not count');

select is((select coins from public.user_stats where user_id = '33333333-3333-3333-3333-333333333333'), 40, 'b: refunded 40');
select is((select inventory from public.user_stats where user_id = '33333333-3333-3333-3333-333333333333'), '{frame_bronze}'::text[], 'b: frame_bronze kept as a reward');
select is((select equipped from public.user_stats where user_id = '33333333-3333-3333-3333-333333333333'), '{"frame": "frame_bronze"}'::jsonb, 'b: equip after the badge counts');

select is((select coins from public.user_stats where user_id = '44444444-4444-4444-4444-444444444444'), 40, 'c: refunded 40');
select is((select inventory from public.user_stats where user_id = '44444444-4444-4444-4444-444444444444'), '{}'::text[], 'c: no badge, no frame');
select is((select equipped from public.user_stats where user_id = '44444444-4444-4444-4444-444444444444'), '{}'::jsonb, 'c: nothing equipped');

select is((select coins from public.user_stats where user_id = '55555555-5555-5555-5555-555555555555'), 7, 'd: no refund');
select is((select inventory from public.user_stats where user_id = '55555555-5555-5555-5555-555555555555'), '{fx_lightning}'::text[], 'd: badge reward granted');

select * from finish();
rollback;
