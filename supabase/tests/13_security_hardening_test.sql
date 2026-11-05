begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Security audit of 2026-11-04. The xu cap is mirrored by src/services/wallet.test.ts.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.fr'),
  ('b0000000-0000-0000-0000-000000000002', 'bob@test.fr');
insert into public.groups (id, name, invite_code) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.lessons(n int, at timestamptz) returns void language sql as $$
  insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  select gen_random_uuid(), auth.uid(), 'lesson_completed', 'l01', 0, '{"perfect":true}'::jsonb, at from generate_series(1, n)
$$;
create function pg_temp.report() returns void language sql as $$
  insert into public.content_reports (user_id, ref_id, message) values (auth.uid(), 'l01', 'typo')
$$;
create function pg_temp.coins() returns int language sql as $$
  select coins from public.user_stats where user_id = auth.uid()
$$;

-- invite code: wrong tries are logged even though they fail, 5 per hour, per account
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(public.join_group('NOPE', 'Alice', '🐉'), 'invalid_invite', 'wrong try 1');
select is(public.join_group('NOPE', 'Alice', '🐉'), 'invalid_invite', 'wrong try 2');
select is(public.join_group('NOPE', 'Alice', '🐉'), 'invalid_invite', 'wrong try 3');
select is(public.join_group('NOPE', 'Alice', '🐉'), 'invalid_invite', 'wrong try 4');
select is(public.join_group('NOPE', 'Alice', '🐉'), 'invalid_invite', 'wrong try 5');
select is(public.join_group('NOPE', 'Alice', '🐉'), 'too_many_attempts', 'the sixth try is refused');
select is(public.join_group('FAM', 'Alice', '🐉'), 'too_many_attempts', 'even with the right code');
select throws_ok($$ select * from public.join_attempts $$, '42501', null, 'clients cannot read the tries');
select throws_ok($$ delete from public.join_attempts $$, '42501', null, 'clients cannot clear the tries');

reset role;
update public.join_attempts set created_at = now() - interval '2 hours';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(public.join_group('FAM', 'Alice', '🐉'), 'joined', 'an hour later the right code joins');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is(public.join_group('FAM', 'Bob', '🐯'), 'joined', 'one account does not block another');

-- daily xu cap: 13 perfect lessons pay 195, the 14th only reaches 200, the 15th pays nothing
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.lessons(14, now());
reset role;
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.coins(), 200, 'activity xu stop at 200 in a day');
select pg_temp.lessons(1, now());
select is(pg_temp.coins(), 200, 'a lesson past the cap pays nothing');
select pg_temp.lessons(1, now() - interval '3 days');
select is(pg_temp.coins(), 200, 'an event dated in the past does not reopen a day');
select is((select lessons_done from public.user_stats where user_id = auth.uid()), array['l01'], 'capped lessons still count as done');

reset role;
update public.user_stats set coins_day = coins_day - 1 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.lessons(1, now());
select is(pg_temp.coins(), 215, 'a new day opens a new allowance');
select is((select coins_today from public.user_stats where user_id = auth.uid()), 15, 'and counts from zero');

-- size limits
select throws_ok($$ insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), 'lesson_completed', 'l01', 0, jsonb_build_object('x', repeat('a', 9000)), now()) $$,
  '23514', null, 'an oversized payload is refused');
select throws_ok($$ insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
  values (gen_random_uuid(), auth.uid(), 'lesson_completed', repeat('a', 201), 0, now()) $$,
  '23514', null, 'an oversized ref_id is refused');

-- content reports: 20 per day, the extra ones are dropped without an error
select pg_temp.report() from generate_series(1, 20);
select lives_ok($$ select pg_temp.report() $$, 'the 21st report does not fail');
reset role;
select is((select count(*)::int from public.content_reports), 20, 'and is not stored');

-- privileges
select is(has_table_privilege('authenticated', 'public.events', 'truncate'), false, 'authenticated cannot truncate');
select is(has_table_privilege('anon', 'public.events', 'truncate'), false, 'anon cannot truncate');
select is(has_table_privilege('anon', 'public.profiles', 'insert'), false, 'anon cannot write');
select is(has_table_privilege('authenticated', 'public.events', 'insert'), true, 'the app can still sync events');

select * from finish();
rollback;
