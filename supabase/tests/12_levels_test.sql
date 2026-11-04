begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Levels (levels spec 2026-11-04): 3 attempts per day and per boss, one best score per boss, a boss above level 1 only
-- after the boss before it. Mirrored by src/services/wallet.test.ts and src/services/progress.test.ts.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000001', 'alice@test.fr');
insert into public.groups (id, name, invite_code) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.start(name text, lang text, boss text) returns int language plpgsql as $$
declare r json;
begin
  r := public.start_exam_attempt(lang, boss);
  perform set_config('t.' || name, r->>'attempt_id', true);
  return (r->>'remaining_today')::int;
end $$;
create function pg_temp.finish(name text, score int) returns void language sql as $$
  insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), 'exam_finished', 'boss_son_tinh', 100,
    json_build_object('score', score, 'attemptId', current_setting('t.' || name), 'noSpeaking', false)::jsonb, now())
$$;
create function pg_temp.stats() returns public.user_stats language sql as $$
  select * from public.user_stats where user_id = auth.uid()
$$;

select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');

-- the gate
select throws_ok($$ select pg_temp.start('x', 'vi', 'boss_son_tinh') $$, 'P0001', 'boss_locked', 'Sơn Tinh waits for Thủy Tinh');
select throws_ok($$ select pg_temp.start('x', 'tl', 'tl_boss_tikbalang') $$, 'P0001', 'boss_locked', 'the Tikbalang waits for Bakunawa');
select throws_ok($$ select pg_temp.start('x', 'vi', 'tl_boss_tikbalang') $$, 'P0001', 'invalid_boss', 'a boss of another language is refused');
select throws_ok($$ select pg_temp.start('x', 'vi', 'boss_nope') $$, 'P0001', 'invalid_boss', 'an unknown boss is refused');
select is(pg_temp.start('v1', 'vi', null), 2, 'level 1 needs no boss argument');
select lives_ok($$ insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100,
    json_build_object('score', 69, 'attemptId', current_setting('t.v1'), 'noSpeaking', false)::jsonb, now()) $$, 'a defeat is scored');
select throws_ok($$ select pg_temp.start('x', 'vi', 'boss_son_tinh') $$, 'P0001', 'boss_locked', 'a defeat does not open the level');
reset role;
update public.user_stats set exam_best = 70, coins = 0, xp_total = 0, xp_today = 0, xp_week = 0 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');

-- attempts per boss
select is(pg_temp.start('s1', 'vi', 'boss_son_tinh'), 2, 'the win opens Sơn Tinh, with his own 3 attempts');
select is(pg_temp.start('s2', 'vi', 'boss_son_tinh'), 1, 'second attempt');
select is(pg_temp.start('s3', 'vi', 'boss_son_tinh'), 0, 'third attempt');
select throws_ok($$ select pg_temp.start('s4', 'vi', 'boss_son_tinh') $$, 'P0001', 'exam_limit', 'a 4th attempt is refused');

-- best score per boss
select lives_ok($$ select pg_temp.finish('s1', 85) $$, 'scoring never raises');
select is((pg_temp.stats()).exam_bests, '{"boss_son_tinh": 85}'::jsonb, 'his best score is kept under his id');
select is((pg_temp.stats()).exam_best, 70, 'the level 1 best does not move');
select is((pg_temp.stats()).coins, 50, 'a first win against him pays the first-win 50 xu');

select * from finish();
rollback;
