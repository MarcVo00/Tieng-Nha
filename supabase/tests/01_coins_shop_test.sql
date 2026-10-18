begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

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

create function pg_temp.start_attempt(name text) returns int language plpgsql as $$
declare r json;
begin
  r := public.start_exam_attempt();
  perform set_config('t.' || name, r->>'attempt_id', true);
  return (r->>'remaining_today')::int;
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

-- ---------- alice: earning ----------
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
select is(pg_temp.coins(), 0, 'new player starts with 0 coins');

select pg_temp.ev('lesson_completed', '{"perfect": true}', now(), 'l01');
select is(pg_temp.coins(), 15, 'perfect lesson credits 15');
select pg_temp.ev('lesson_completed', '{"perfect": false}', now(), 'l02');
select is(pg_temp.coins(), 25, 'non-perfect lesson credits 10');
select pg_temp.ev('dialogue_completed', '{}', now(), 'd01');
select is(pg_temp.coins(), 30, 'dialogue credits 5');
select pg_temp.ev('review_session_completed');
select is(pg_temp.coins(), 33, 'review session credits 3');
select pg_temp.ev('badge_unlocked', '{}', now(), 'b01');
select is(pg_temp.coins(), 43, 'badge credits 10');
select pg_temp.ev('lesson_completed', '{"perfect": "true"}', now(), 'l03');
select is(pg_temp.coins(), 53, 'perfect as a string is not perfect (10 only)');

-- ---------- alice: exams ----------
select is(pg_temp.start_attempt('a1'), 2, 'attempt 1');
select pg_temp.ev('exam_finished', jsonb_build_object('score', 85, 'attemptId', current_setting('t.a1')));
select is(pg_temp.coins(), 103, 'first exam win credits 50');
select is(pg_temp.start_attempt('a2'), 1, 'attempt 2');
select pg_temp.ev('exam_finished', jsonb_build_object('score', 85, 'attemptId', current_setting('t.a2')));
select is(pg_temp.coins(), 123, 'second exam win credits 20');
select is(pg_temp.start_attempt('a3'), 0, 'attempt 3');
select pg_temp.ev('exam_finished', jsonb_build_object('score', 40, 'attemptId', current_setting('t.a3')));
select is(pg_temp.coins(), 123, 'lost exam credits 0');
select pg_temp.ev('exam_finished', jsonb_build_object('score', 90, 'attemptId', gen_random_uuid()));
select is(pg_temp.coins(), 123, 'forged attempt id credits 0 coins');
select is((select exam_best from public.user_stats where user_id = auth.uid()), 85, 'exam_best unchanged by lost and forged exams');

-- malformed payloads never raise and never credit
select lives_ok($$ insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at) values
  (gen_random_uuid(), auth.uid(), 'exam_finished', 'x', 0, '{"score": "abc", "attemptId": "zzz"}', now()),
  (gen_random_uuid(), auth.uid(), 'exam_finished', 'x', 0, '{"score": null}', now()),
  (gen_random_uuid(), auth.uid(), 'exam_finished', 'x', 0, 'null', now()),
  (gen_random_uuid(), auth.uid(), 'item_purchased', 'x', 0, 'null', now()),
  (gen_random_uuid(), auth.uid(), 'item_purchased', 'x', 0, '{"itemId": null}', now()),
  (gen_random_uuid(), auth.uid(), 'item_purchased', 'x', 0, '{"itemId": 42}', now()),
  (gen_random_uuid(), auth.uid(), 'item_equipped', 'x', 0, 'null', now()),
  (gen_random_uuid(), auth.uid(), 'item_equipped', 'x', 0, '{"itemId": "frame_bronze"}', now()),
  (gen_random_uuid(), auth.uid(), 'item_equipped', 'x', 0, '{"slot": null, "itemId": null}', now()),
  (gen_random_uuid(), auth.uid(), 'lesson_completed', 'x', 0, 'null', now()),
  (gen_random_uuid(), auth.uid(), 'badge_unlocked', 'x', 0, '[1,2]', now()) $$,
  'malformed payloads do not raise');
select is(pg_temp.coins(), 143, 'malformed payloads credit only the flat types (lesson 10 + badge 10), nothing else');

-- ---------- alice: shop ----------
-- frames became reward-only in 20261019: the purchase is refused (see 02_), so the old
-- purchase outcome (-40 coins, frame in inventory) is set up directly.
select pg_temp.ev('item_purchased', '{"itemId": "frame_bronze"}');
select is(pg_temp.coins(), 143, 'frame_bronze is no longer purchasable');
reset role;
update public.user_stats set coins = coins - 40, inventory = '{frame_bronze}' where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select ok((select 'frame_bronze' = any(inventory) from public.user_stats where user_id = auth.uid()), 'frame_bronze in inventory');
select pg_temp.ev('item_purchased', '{"itemId": "frame_bronze"}');
select is(pg_temp.coins(), 103, 'buying an owned cosmetic again has no effect');
select is((select array_length(inventory, 1) from public.user_stats where user_id = auth.uid()), 1, 'inventory has one entry');
select pg_temp.ev('item_purchased', '{"itemId": "frame_son_mai"}');
select is(pg_temp.coins(), 103, 'too expensive: no effect');
select is((select array_length(inventory, 1) from public.user_stats where user_id = auth.uid()), 1, 'too expensive: not in inventory');
select pg_temp.ev('item_purchased', '{"itemId": "unicorn"}');
select is(pg_temp.coins(), 103, 'unknown item: no effect');
select pg_temp.ev('item_purchased', '{}');
select is(pg_temp.coins(), 103, 'missing itemId: no effect');
select pg_temp.ev('item_purchased', '{"itemId": "energy_refill", "price": 0}');
select is(pg_temp.coins(), 73, 'price comes from the catalogue; energy_refill costs 30 and adds nothing to inventory');
select is((select array_length(inventory, 1) from public.user_stats where user_id = auth.uid()), 1, 'energy_refill is not stored in inventory');

-- ---------- alice: equipment ----------
select pg_temp.ev('item_equipped', '{"slot": "frame", "itemId": "frame_jade"}');
select is((select equipped->>'frame' from public.user_stats where user_id = auth.uid()), null, 'unowned frame cannot be equipped');
select pg_temp.ev('item_equipped', '{"slot": "frame", "itemId": "frame_bronze"}');
select is((select equipped->>'frame' from public.user_stats where user_id = auth.uid()), 'frame_bronze', 'owned frame equipped');
select is((select equipped_frame from public.leaderboard where user_id = auth.uid()), 'frame_bronze', 'leaderboard shows equipped_frame');
select is((select coins from public.leaderboard where user_id = auth.uid()), 73, 'leaderboard shows coins');
select pg_temp.ev('item_equipped', '{"slot": "hat", "itemId": "frame_bronze"}');
select is((select equipped->>'hat' from public.user_stats where user_id = auth.uid()), null, 'wrong slot is refused');
select pg_temp.ev('item_equipped', '{"slot": "frame", "itemId": null}');
select is((select equipped->>'frame' from public.user_stats where user_id = auth.uid()), null, 'itemId null removes the frame');
select is((select equipped_frame from public.leaderboard where user_id = auth.uid()), null, 'leaderboard equipped_frame is null after removal');

-- ---------- alice: streak freeze stock ----------
reset role;
update public.user_stats set coins = 500 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.ev('item_purchased', '{"itemId": "streak_freeze"}');
select pg_temp.ev('item_purchased', '{"itemId": "streak_freeze"}');
select is((select streak_freezes from public.user_stats where user_id = auth.uid()), 2, 'two freezes accepted');
select is(pg_temp.coins(), 400, 'two freezes cost 100');
select pg_temp.ev('item_purchased', '{"itemId": "streak_freeze"}');
select is((select streak_freezes from public.user_stats where user_id = auth.uid()), 2, 'third freeze refused (stock stays 2)');
select is(pg_temp.coins(), 400, 'third freeze refused (coins unchanged)');

-- clients cannot write the wallet
select throws_ok($$ update public.user_stats set coins = 9999 where user_id = auth.uid() $$, '42501', null, 'coins not writable by clients');
select throws_ok($$ update public.user_stats set inventory = '{frame_son_mai}' where user_id = auth.uid() $$, '42501', null, 'inventory not writable by clients');

-- ---------- bob: freeze bridges one missed day ----------
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select public.join_group('FAM', 'Bob', '🐯');
reset role;
update public.user_stats set coins = 100 where user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.ev('lesson_completed', '{}', now() - interval '3 days', 'l01');
select is((select streak from public.user_stats where user_id = auth.uid()), 1, 'bob streak starts at 1');
select pg_temp.ev('item_purchased', '{"itemId": "streak_freeze"}');
select is((select streak_freezes from public.user_stats where user_id = auth.uid()), 1, 'bob owns a freeze');
select pg_temp.ev('lesson_completed', '{}', now() - interval '1 day', 'l02');
select is((select streak from public.user_stats where user_id = auth.uid()), 2, 'one missed day + one freeze: streak continues');
select is((select streak_freezes from public.user_stats where user_id = auth.uid()), 0, 'the freeze is consumed');

-- ---------- bob: score rounding, badge once, item xp ignored ----------
select set_config('t.c0', pg_temp.coins()::text, true);
select is(pg_temp.start_attempt('b1'), 2, 'bob attempt 1');
select pg_temp.ev('exam_finished', jsonb_build_object('score', 69.6, 'attemptId', current_setting('t.b1')));
select is((select exam_best from public.user_stats where user_id = auth.uid()), 70, '69.6 rounds to 70 for exam_best');
select is(pg_temp.coins(), current_setting('t.c0')::int + 50, '69.6 (rounded 70) is a first win: +50');
select is(pg_temp.start_attempt('b2'), 1, 'bob attempt 2');
select pg_temp.ev('exam_finished', jsonb_build_object('score', 75, 'attemptId', current_setting('t.b2')));
select is(pg_temp.coins(), current_setting('t.c0')::int + 70, 'next win: +20');
select pg_temp.ev('badge_unlocked', '{}', now(), 'bx');
select pg_temp.ev('badge_unlocked', '{}', now(), 'bx');
select is(pg_temp.coins(), current_setting('t.c0')::int + 80, 'a duplicate badge_unlocked credits 0 coins');
select set_config('t.xp0', (select xp_total from public.user_stats where user_id = auth.uid())::text, true);
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
values (gen_random_uuid(), auth.uid(), 'item_purchased', 'x', 50, '{"itemId": "frame_bronze"}', now());
select is((select xp_total from public.user_stats where user_id = auth.uid()), current_setting('t.xp0')::int, 'item_purchased with xp > 0 leaves xp_total unchanged');

-- ---------- carol: no freeze, a gap resets ----------
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select public.join_group('FAM', 'Carol', '🐼');
select pg_temp.ev('lesson_completed', '{}', now() - interval '4 days', 'l01');
select pg_temp.ev('lesson_completed', '{}', now() - interval '3 days', 'l02');
select is((select streak from public.user_stats where user_id = auth.uid()), 2, 'carol has a streak of 2');
select pg_temp.ev('lesson_completed', '{}', now() - interval '1 day', 'l03');
select is((select streak from public.user_stats where user_id = auth.uid()), 1, 'without freeze a gap resets to 1');

-- ---------- dave: not enough freezes for the gap ----------
select pg_temp.login('44444444-4444-4444-4444-444444444444');
select public.join_group('FAM', 'Dave', '🦊');
reset role;
update public.user_stats set coins = 100 where user_id = '44444444-4444-4444-4444-444444444444';
select pg_temp.login('44444444-4444-4444-4444-444444444444');
select pg_temp.ev('lesson_completed', '{}', now() - interval '4 days', 'l01');
select pg_temp.ev('item_purchased', '{"itemId": "streak_freeze"}');
select pg_temp.ev('lesson_completed', '{}', now() - interval '1 day', 'l02');
select is((select streak from public.user_stats where user_id = auth.uid()), 1, 'two missed days with one freeze: streak resets');
select is((select streak_freezes from public.user_stats where user_id = auth.uid()), 1, 'freeze not consumed when it cannot cover the gap');

-- ---------- erin: back-fill ----------
select pg_temp.login('55555555-5555-5555-5555-555555555555');
select public.join_group('FAM', 'Erin', '🐸');
reset role;
alter table public.events disable trigger events_apply;
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at) values
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'lesson_completed', 'l01', 10, '{"perfect": true}', now() - interval '8 days'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'exam_finished', 'exam', 0, '{"score": 85}', now() - interval '7 days'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'exam_finished', 'exam', 0, '{"score": 40}', now() - interval '6 days'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'exam_finished', 'exam', 0, '{"score": 90}', now() - interval '5 days'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'badge_unlocked', 'b01', 10, '{}', now() - interval '4 days'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'dialogue_completed', 'd01', 10, '{}', now() - interval '3 days'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'review_session_completed', 'r', 10, '{}', now() - interval '2 days'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'exam_finished', 'exam', 0, '{"score": "abc"}', now() - interval '1 day'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'exam_finished', 'exam', 0, '{"score": "99999999999"}', now() - interval '12 hours'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'badge_unlocked', 'b01', 10, '{}', now() - interval '3 days 12 hours');
alter table public.events enable trigger events_apply;
select is((select coins from public.user_stats where user_id = '55555555-5555-5555-5555-555555555555'), 0, 'trigger disabled: no coins yet');

-- same statement as the migration
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
-- 15 (perfect lesson) + 50 (first win) + 0 (lost) + 20 (second win) + 10 (badge) + 5 (dialogue) + 3 (review) + 0 (bad score) + 20 (huge score clamps to 100, a win) + 0 (duplicate badge)
select is((select coins from public.user_stats where user_id = '55555555-5555-5555-5555-555555555555'), 123, 'back-fill totals (huge score does not overflow) past events');

select pg_temp.login('55555555-5555-5555-5555-555555555555');
select pg_temp.ev('lesson_completed', '{}', now(), 'l02');
select is(pg_temp.coins(), 133, 'new events add on top of the back-fill (no double count)');

-- leaderboard streak honours the freezes left (bob is in the group, so he has a profile)
reset role;
update public.user_stats set streak = 4, last_active_day = public.paris_today() - 2, streak_freezes = 1
  where user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select is((select streak from public.leaderboard where user_id = auth.uid()), 4, 'leaderboard keeps the streak while a freeze covers the missed day');
reset role;
update public.user_stats set streak_freezes = 0 where user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select is((select streak from public.leaderboard where user_id = auth.uid()), 0, 'leaderboard streak is 0 without a freeze after 2 days away');

select * from finish();
rollback;
