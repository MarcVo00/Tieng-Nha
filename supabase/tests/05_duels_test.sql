begin;
create extension if not exists pgtap with schema extensions;
select plan(87);

-- alice (A) and bob (B) duel; carol is in another group; dave lacks the prerequisites.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.fr'),
  ('b0000000-0000-0000-0000-000000000002', 'bob@test.fr'),
  ('c0000000-0000-0000-0000-000000000003', 'carol@test.fr'),
  ('d0000000-0000-0000-0000-000000000004', 'dave@test.fr');
insert into public.groups (id, name, invite_code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Autres', 'OTH');

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

create function pg_temp.kb() returns int language sql as $$
  select kim_bai from public.user_stats where user_id = auth.uid()
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

-- n questions of lessons l01/l02
create function pg_temp.refs(n int) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('lessonId', case when i % 2 = 0 then 'l01' else 'l02' end, 'exerciseId', 'ex' || i))
  from generate_series(1, n) i
$$;
create function pg_temp.q(n1 int, n2 int) returns jsonb language sql as $$
  select jsonb_build_object('round1', pg_temp.refs(n1), 'round2', pg_temp.refs(n2))
$$;
-- n round-1 answers, all with the same correctness and time
create function pg_temp.r1(n int, ok boolean, ms int) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('correct', ok, 'ms', ms)) from generate_series(1, n)
$$;
-- n round-2 answers: the first k correct
create function pg_temp.r2(n int, k int) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('correct', i <= k)) from generate_series(1, n) i
$$;
create function pg_temp.err(j json) returns text language sql as $$ select j->>'error' $$;
create function pg_temp.did() returns uuid language sql as $$ select current_setting('t.duel')::uuid $$;
-- one field of one duel in list_duels (all duels of a test share one created_at, so no ordering is asserted)
create function pg_temp.lf(id uuid, f text) returns text language sql as $$
  select e->>f from json_array_elements(public.list_duels()) e where e->>'id' = id::text
$$;
create function pg_temp.mk(opp uuid, n1 int, n2 int) returns json language plpgsql as $$
declare j json;
begin
  j := public.create_duel(opp, pg_temp.q(n1, n2), 42);
  perform set_config('t.duel', coalesce(j->>'duelId', ''), true);
  return j;
end $$;

-- ---------- catalogue (as postgres) ----------
select is((select price || '/' || kind || '/' || slot || '/' || currency from public.shop_item('hat_tay_son')), '6/cosmetic/hat/kim_bai', 'hat_tay_son: 6 Kim bai hat');
select is((select price || '/' || kind || '/' || slot || '/' || currency from public.shop_item('acc_con_vo')), '8/cosmetic/accessory/kim_bai', 'acc_con_vo: 8 Kim bai accessory');
select is((select price || '/' || kind || '/' || slot || '/' || currency from public.shop_item('outfit_hoi_vat')), '10/cosmetic/outfit/kim_bai', 'outfit_hoi_vat: 10 Kim bai outfit');
select is((select currency from public.shop_item('energy_refill')), 'xu', 'existing items are paid in xu');
select is((select count(*)::int from public.shop_item('char_phap_su') where currency = 'xu' and price = 200), 1, 'previous rows are unchanged');

-- ---------- scoring rules ----------
select is(public.duel_damage(pg_temp.r1(8, true, 1000), pg_temp.r2(3, 3)), 165, 'all correct and fast: 8x15 + 3x15 = 165');
select is(public.duel_damage('[{"correct":true,"ms":200}]', '[]'), 10, 'correct under 300 ms counts 10 (no critical)');
select is(public.duel_damage('[{"correct":true,"ms":299},{"correct":true,"ms":300}]', '[]'), 25, '299 ms = 10, 300 ms = 15');
select is(public.duel_damage('[{"correct":true,"ms":2999},{"correct":true,"ms":3000}]', '[]'), 25, '2999 ms = 15, 3000 ms = 10');
select is(public.duel_damage('[{"correct":true,"ms":20000},{"correct":true,"ms":20001}]', '[]'), 10, '20000 ms = 10, 20001 ms = a miss');
select is(public.duel_damage('[{"correct":true,"ms":25000}]', '[]'), 0, 'correct over 20 s is a miss');
select is(public.duel_damage('[{"correct":true,"ms":1000},{"correct":true,"ms":200},{"correct":true,"ms":25000},{"correct":false,"ms":500},{"correct":true,"ms":3000}]',
                             '[{"correct":true},{"correct":false}]'), 50, 'mixed: 15+10+0+0+10 + 15 = 50');
select is(public.duel_time('[{"ms":1000},{"ms":30000},{"ms":200}]'), 21200, 'time: sum of ms, each capped at 20000');

-- ---------- setup: players and prerequisites ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.join_group('FAM', 'Bob', '🐲') $$, 'bob joins');
select pg_temp.login('c0000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.join_group('OTH', 'Carol', '🦊') $$, 'carol joins another group');
select pg_temp.login('d0000000-0000-0000-0000-000000000004');
select lives_ok($$ select public.join_group('FAM', 'Dave', '🐯') $$, 'dave joins');
reset role;
update public.user_stats set lessons_done = '{l01,l02,l03}', dialogues_done = '{d01}'
  where user_id = 'a0000000-0000-0000-0000-000000000001';
update public.user_stats set lessons_done = '{l01,l02}', dialogues_done = '{d01}'
  where user_id = 'b0000000-0000-0000-0000-000000000002';
update public.user_stats set lessons_done = '{l01,l02}', dialogues_done = '{d01}'
  where user_id = 'c0000000-0000-0000-0000-000000000003';
update public.user_stats set lessons_done = '{l01,l02}', dialogues_done = '{}'
  where user_id = 'd0000000-0000-0000-0000-000000000004';

-- ---------- create_duel refusals (as alice) ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.create_duel('a0000000-0000-0000-0000-000000000001', pg_temp.q(8, 3), 1)), 'self', 'create: self');
select is(pg_temp.err(public.create_duel('c0000000-0000-0000-0000-000000000003', pg_temp.q(8, 3), 1)), 'not_same_group', 'create: other group');
select is(pg_temp.err(public.create_duel('d0000000-0000-0000-0000-000000000004', pg_temp.q(8, 3), 1)), 'prerequisites', 'create: opponent lacks the dialogue');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002',
  jsonb_build_object('round1', pg_temp.refs(3), 'round2', pg_temp.refs(1)), 1)), 'bad_questions', 'create: 3 round-1 questions');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002',
  jsonb_build_object('round1', pg_temp.refs(9), 'round2', pg_temp.refs(1)), 1)), 'bad_questions', 'create: 9 round-1 questions');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002',
  jsonb_build_object('round1', pg_temp.refs(8), 'round2', pg_temp.refs(0)), 1)), 'bad_questions', 'create: no oral question');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002',
  jsonb_build_object('round1', pg_temp.refs(8), 'round2', pg_temp.refs(4)), 1)), 'bad_questions', 'create: 4 oral questions');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002',
  '{"round1":[1,2,3,4],"round2":[{"lessonId":"l01","exerciseId":"x"}]}', 1)), 'bad_questions', 'create: malformed refs');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', null, 1)), 'bad_questions', 'create: null questions');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002',
  jsonb_set(pg_temp.q(8, 3), '{round1,0,lessonId}', '"l03"'), 1)), 'not_common_lesson', 'create: lesson done by alice only');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q(8, 3), null)), 'bad_questions', 'create: null seed');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002',
  jsonb_set(pg_temp.q(8, 3), '{round1,0,exerciseId}', to_jsonb(repeat('x', 65))), 1)), 'bad_questions', 'create: over-long exerciseId');
select pg_temp.login('d0000000-0000-0000-0000-000000000004');
select is(pg_temp.err(public.create_duel('a0000000-0000-0000-0000-000000000001', pg_temp.q(8, 3), 1)), 'prerequisites', 'create: the challenger lacks the dialogue');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
reset role;
select is((select count(*)::int from public.duels), 0, 'refusals created no duel');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');

-- ---------- create ----------
select is((pg_temp.mk('b0000000-0000-0000-0000-000000000002', 8, 3))->>'ok', 'true', 'create: ok');
reset role;
select is((select count(*)::int from public.duels where id = pg_temp.did() and status = 'open'
  and expires_at > now() + interval '71 hours 59 minutes' and expires_at < now() + interval '72 hours 1 minute'
  and group_id = 'aaaaaaaa-0000-0000-0000-000000000001' and seed = 42), 1, 'the duel is open and expires in 72 h');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q(8, 3), 1)), 'already_open', 'create: one open duel per pair');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is(pg_temp.err(public.create_duel('a0000000-0000-0000-0000-000000000001', pg_temp.q(8, 3), 1)), 'already_open', 'create: the pair is symmetric');

-- ---------- submit refusals ----------
select is(pg_temp.err(public.submit_duel_run(gen_random_uuid(), pg_temp.r1(8, true, 1000), pg_temp.r2(3, 3))), 'not_found', 'submit: unknown duel');
select pg_temp.login('c0000000-0000-0000-0000-000000000003');
select is(pg_temp.err(public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, true, 1000), pg_temp.r2(3, 3))), 'not_participant', 'submit: not a participant');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.submit_duel_run(pg_temp.did(), pg_temp.r1(7, true, 1000), pg_temp.r2(3, 3))), 'bad_run', 'submit: wrong round-1 length');
select is(pg_temp.err(public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, true, 1000), pg_temp.r2(2, 2))), 'bad_run', 'submit: wrong round-2 length');
select is(pg_temp.err(public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, true, -5), pg_temp.r2(3, 3))), 'bad_run', 'submit: negative time');
select is(pg_temp.err(public.submit_duel_run(pg_temp.did(), '[{"correct":"yes","ms":10}]', pg_temp.r2(3, 3))), 'bad_run', 'submit: malformed answer');

-- ---------- D1: A 165 vs B 150 (settlement by damage) ----------
select is((public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, true, 1000), pg_temp.r2(3, 3)))->>'status', 'open', 'submit: first run keeps the duel open');
select is(pg_temp.err(public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, true, 1000), pg_temp.r2(3, 3))), 'already_submitted', 'submit: a second run is refused');
select pg_temp.ev('duel_settled', pg_temp.did()::text, '{"kimBai": 99}');
select is(pg_temp.kb(), 0, 'duel_settled before settlement credits nothing');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is(json_array_length(public.list_duels()), 1, 'list: bob sees the duel');
select is((select (public.list_duels())->0->>'theirRun'), null, 'list: alice''s run is hidden from bob before he plays');
select is((public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, true, 1000), pg_temp.r2(3, 2)))->>'status', 'settled', 'submit: second run settles the duel');
select is(pg_temp.err(public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, true, 1000), pg_temp.r2(3, 2))), 'not_open', 'submit: settled duel is not open');
reset role;
select is((select damage || '/' || time_ms from public.duel_runs where duel_id = pg_temp.did() and user_id = 'a0000000-0000-0000-0000-000000000001'), '165/8000', 'server computed alice: 165 damage, 8000 ms');
select is((select damage from public.duel_runs where duel_id = pg_temp.did() and user_id = 'b0000000-0000-0000-0000-000000000002'), 150, 'server computed bob: 150 damage');
select is((select winner from public.duels where id = pg_temp.did()), 'a0000000-0000-0000-0000-000000000001'::uuid, 'higher damage wins');
select is((select string_agg(reward::text, '/' order by damage desc) from public.duel_runs where duel_id = pg_temp.did()), '3/1', 'win 3, loss 1');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is((select (public.list_duels())->0->'theirRun'->>'damage'), '150', 'list: both runs visible once settled');
select is((select (public.list_duels())->0->>'opponentPseudo'), 'Bob', 'list: opponent pseudo');

-- duel_settled pays the server amount once
select pg_temp.ev('duel_settled', pg_temp.did()::text, '{"kimBai": 99}', 50);
select is(pg_temp.kb(), 3, 'duel_settled credits the server reward (3), not the client amount');
select is(pg_temp.xp(), 0, 'duel_settled never gives XP');
select pg_temp.ev('duel_settled', pg_temp.did()::text, '{"kimBai": 3}');
select is(pg_temp.kb(), 3, 'a second duel_settled for the same duel changes nothing');
select pg_temp.ev('duel_settled', 'not-a-uuid', '{"kimBai": 3}');
select pg_temp.ev('duel_settled', gen_random_uuid()::text, '{"kimBai": 3}');
select is(pg_temp.kb(), 3, 'garbage or unknown duel ids credit nothing and never raise');

-- ---------- D2: tie on damage, broken by time (bob faster) ----------
select is((pg_temp.mk('b0000000-0000-0000-0000-000000000002', 4, 1))->>'ok', 'true', 'create: 4 + 1 questions are allowed');
select public.submit_duel_run(pg_temp.did(), pg_temp.r1(4, true, 2000), pg_temp.r2(1, 1));
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select public.submit_duel_run(pg_temp.did(), pg_temp.r1(4, true, 1000), pg_temp.r2(1, 1));
reset role;
select is((select winner from public.duels where id = pg_temp.did()), 'b0000000-0000-0000-0000-000000000002'::uuid, 'equal damage: the lower time wins');
select is((select string_agg(reward::text, '/' order by time_ms) from public.duel_runs where duel_id = pg_temp.did()), '3/1', 'tie-break rewards 3/1');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.ev('duel_settled', pg_temp.did()::text);
select is(pg_temp.kb(), 4, 'a lost duel pays 1 Kim bai');

-- ---------- D3: exact tie is a draw ----------
select pg_temp.mk('b0000000-0000-0000-0000-000000000002', 5, 2);
select public.submit_duel_run(pg_temp.did(), pg_temp.r1(5, true, 1000), pg_temp.r2(2, 1));
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select public.submit_duel_run(pg_temp.did(), pg_temp.r1(5, true, 1000), pg_temp.r2(2, 1));
reset role;
select is((select winner from public.duels where id = pg_temp.did() and status = 'settled'), null, 'exact tie: draw (no winner)');
select is((select status from public.duels where id = pg_temp.did()), 'settled', 'a draw is settled');
select is((select string_agg(reward::text, '/') from public.duel_runs where duel_id = pg_temp.did()), '2/2', 'a draw pays 2 each');

-- ---------- D4: expiry with one run -> forfeit, settled through list_duels ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.mk('b0000000-0000-0000-0000-000000000002', 8, 3);
select public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, false, 5000), pg_temp.r2(3, 0));
reset role;
update public.duels set expires_at = now() - interval '1 minute' where id = pg_temp.did();
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is(pg_temp.err(public.submit_duel_run(pg_temp.did(), pg_temp.r1(8, true, 1000), pg_temp.r2(3, 3))), 'not_open', 'a late run on an expired duel is refused (and settles it)');
reset role;
select is((select status || '/' || (winner = 'a0000000-0000-0000-0000-000000000001')::text from public.duels where id = pg_temp.did()), 'settled/true', 'one run + expiry: settled, the player wins by forfeit');
select is((select reward from public.duel_runs where duel_id = pg_temp.did()), 3, 'forfeit win pays 3');
select is((select count(*)::int from public.duel_runs where duel_id = pg_temp.did()), 1, 'the absentee has no run (reward 0)');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select pg_temp.ev('duel_settled', pg_temp.did()::text);
select is(pg_temp.kb(), 0, 'the absentee is credited nothing');
select is(pg_temp.lf(pg_temp.did(), 'myRun'), null, 'list: the absentee has no run');

-- ---------- D5: expiry with no run -> cancelled; create settles stale duels first ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.mk('b0000000-0000-0000-0000-000000000002', 8, 3);
reset role;
update public.duels set expires_at = now() - interval '1 minute' where id = pg_temp.did();
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is((pg_temp.mk('a0000000-0000-0000-0000-000000000001', 8, 3))->>'ok', 'true', 'a stale open duel does not block a new challenge');
reset role;
select is((select status from public.duels where expires_at < now() and status <> 'settled'), 'cancelled', 'expired with nobody played: cancelled');
select is((select count(*)::int from public.duel_runs r join public.duels d on d.id = r.duel_id where d.status = 'cancelled'), 0, 'a cancelled duel pays nothing');

-- ---------- daily limit: alice has created D1..D5 today ----------
update public.duels set status = 'cancelled' where status = 'open';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q(8, 3), 1)), 'daily_limit', 'create: 5 challenges per Paris day, the 6th is refused');
select is(json_array_length(public.list_duels()), 6, 'list: the six duels of alice');

-- ---------- Kim bai purchases ----------
reset role;
update public.user_stats set kim_bai = 5, coins = 1000 where user_id = 'b0000000-0000-0000-0000-000000000002';
update public.user_stats set kim_bai = 6, coins = 100 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "hat_tay_son"}');
select is(pg_temp.kb() || '/' || pg_temp.coins(), '5/1000', 'a Kim bai item is refused with 5 Kim bai, xu are not used');
select ok(not ('hat_tay_son' = any(pg_temp.inv())), 'the refused purchase leaves the inventory unchanged');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "hat_tay_son"}');
select is(pg_temp.kb() || '/' || pg_temp.coins(), '0/100', 'hat_tay_son costs 6 Kim bai and no xu');
select ok('hat_tay_son' = any(pg_temp.inv()), 'hat_tay_son is in the inventory');
select pg_temp.ev('item_equipped', 'x', '{"slot": "hat", "itemId": "hat_tay_son"}');
select is((select equipped->>'hat' from public.user_stats where user_id = auth.uid()), 'hat_tay_son', 'the arena hat can be equipped');
select pg_temp.ev('item_purchased', 'x', '{"itemId": "energy_refill"}');
select is(pg_temp.kb() || '/' || pg_temp.coins(), '0/70', 'an xu purchase still debits xu only');

-- ---------- RLS ----------
select throws_ok($$ select count(*) from public.duels $$, '42501', null, 'a player cannot select duels directly');
select throws_ok($$ select count(*) from public.duel_runs $$, '42501', null, 'a player cannot select duel runs directly');
select throws_ok($$ truncate public.duels cascade $$, '42501', null, 'a player cannot truncate duels');
select throws_ok($$ insert into public.duels (group_id, challenger, opponent, questions, seed, expires_at)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '{}', 1, now()) $$,
  '42501', null, 'a player cannot insert a duel directly');
select throws_ok($$ select public.settle_duel(gen_random_uuid()) $$, '42501', null, 'settle_duel is not callable by players');

select * from finish();
rollback;
