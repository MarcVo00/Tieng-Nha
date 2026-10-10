begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- fixtures (as postgres)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.fr'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.fr'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.fr');
insert into public.groups (id, name, invite_code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Autre', 'OTHER');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- starts an exam attempt, remembers its id under t.<name>, returns remaining_today
create function pg_temp.start_attempt(name text) returns int language plpgsql as $$
declare r json;
begin
  r := public.start_exam_attempt();
  perform set_config('t.' || name, r->>'attempt_id', true);
  return (r->>'remaining_today')::int;
end $$;

-- join_group
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins FAM');
select throws_ok($$ select public.join_group('NOPE', 'Alice', '🐉') $$, 'P0001', 'invalid_invite', 'bad invite rejected');
select lives_ok($$ select public.join_group('  fam ', 'Alice', '🐉') $$, 'lowercase code with spaces still joins');

-- events → stats, idempotence
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'lesson_completed', 'l01', 15, now());
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'lesson_completed', 'l01', 15, now())
on conflict (client_id) do nothing;
select is((select xp_total from public.user_stats where user_id = auth.uid()), 15, 'xp counted once (idempotent)');
select is((select lessons_done from public.user_stats where user_id = auth.uid()), array['l01'], 'lesson recorded');
select is((select streak from public.user_stats where user_id = auth.uid()), 1, 'streak starts at 1');

-- exam events are bound to the user's own unscored attempts
select is(pg_temp.start_attempt('a1'), 2, 'attempt 1 leaves 2');
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
values (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100,
  jsonb_build_object('score', 72, 'attemptId', current_setting('t.a1')), now());
select is((select xp_total from public.user_stats where user_id = auth.uid()), 15 + 72, 'valid attempt credits score, client xp ignored');

-- forged uuid, non-uuid attemptId, and replay of an already scored attempt: stored but credit 0
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at) values
  (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100, jsonb_build_object('score', 95, 'attemptId', gen_random_uuid()), now()),
  (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100, '{"score": 95, "attemptId": "not-a-uuid"}', now()),
  (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100, jsonb_build_object('score', 95, 'attemptId', current_setting('t.a1')), now());
select is((select xp_total from public.user_stats where user_id = auth.uid()), 87, 'forged/invalid/replayed attempts credit 0');
select is((select exam_best from public.user_stats where user_id = auth.uid()), 72, 'exam_best unchanged by invalid attempts');
select is((select score from public.exam_attempts where id = current_setting('t.a1')::uuid), 72, 'attempt 1 marked scored');

select is(pg_temp.start_attempt('a2'), 1, 'attempt 2 leaves 1');
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
values (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100,
  jsonb_build_object('score', 80, 'attemptId', current_setting('t.a2')), now());
select is((select xp_total from public.user_stats where user_id = auth.uid()), 15 + 72 + 8, 'exam xp = delta over best');
select is((select exam_best from public.user_stats where user_id = auth.uid()), 80, 'exam best stored');
select is((select score from public.exam_attempts where id = current_setting('t.a2')::uuid), 80, 'attempt 2 marked scored');

-- daily cap (already 95 today): +10 x 12 = 120 → capped at 200 total today
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
select gen_random_uuid(), auth.uid(), 'lesson_completed', 'l0' || g, 10, now() from generate_series(1, 12) g;
select is((select xp_today from public.user_stats where user_id = auth.uid()), 200, 'daily cap 200');

-- clients cannot write stats directly, nor insert events for someone else
select throws_ok($$ update public.user_stats set xp_total = 9999 where user_id = auth.uid() $$, '42501', null, 'stats not writable');
select throws_ok($$ insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
  values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'lesson_completed', 'x', 5, now()) $$,
  '42501', null, 'cannot insert an event for another user');

-- exam limit (2 used, third is the last)
select is(pg_temp.start_attempt('a3'), 0, 'attempt 3 leaves 0');
select throws_ok($$ select public.start_exam_attempt() $$, 'P0001', 'exam_limit', '4th attempt refused');
select throws_ok($$ update public.exam_attempts set score = 100 where id = current_setting('t.a3')::uuid $$, '42501', null, 'exam score not writable by clients');

-- weekly reset (stale week_start set by postgres)
reset role;
update public.user_stats set week_start = week_start - 7, xp_today = 0
where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
values (gen_random_uuid(), auth.uid(), 'lesson_completed', 'lweek', 10, now());
select is((select xp_week from public.user_stats where user_id = auth.uid()), 10, 'xp_week reset on new week');
select is((select xp_total from public.user_stats where user_id = auth.uid()), 210, 'xp_total kept across weeks');
reset role;
update public.user_stats set week_start = week_start - 7 where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select is((select xp_week from public.leaderboard where user_id = auth.uid()), 0, 'leaderboard shows 0 xp_week for a stale week');

-- bob, same group: sees alice's stats, not her events
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select throws_ok($$ select public.join_group('FAM', 'Alice', '🐯') $$, 'P0001', 'pseudo_taken', 'duplicate pseudo rejected');
select lives_ok($$ select public.join_group('FAM', 'Bob', '🐯') $$, 'bob joins FAM');
select is((select count(*)::int from public.leaderboard), 2, 'bob sees 2 rows in his group leaderboard');
select is((select count(*)::int from public.events), 0, 'bob cannot read alice events');
update public.profiles set pseudo = 'Hacked' where id = '11111111-1111-1111-1111-111111111111';
select is((select pseudo from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'bob cannot update alice profile');
select throws_ok($$ update public.profiles set group_id = 'aaaaaaaa-0000-0000-0000-000000000002' where id = auth.uid() $$,
  '42501', null, 'group_id not updatable');

-- carol, other group: isolated
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select lives_ok($$ select public.join_group('OTHER', 'Carol', '🐼') $$, 'carol joins OTHER');
select is((select count(*)::int from public.leaderboard), 1, 'carol only sees her own group');
select is((select count(*)::int from public.profiles where group_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'carol sees no FAM profiles');
select is((select count(*)::int from public.groups where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'carol cannot see group FAM');
select throws_ok($$ select public.join_group('OTHER', 'x', '🐼') $$, 'P0001', 'invalid_profile', 'too-short pseudo rejected');

-- delete_my_account cascades
select lives_ok($$ select public.delete_my_account() $$, 'carol deletes her account');
reset role;
select is((select count(*)::int from public.user_stats where user_id = '33333333-3333-3333-3333-333333333333'), 0, 'user_stats cascaded');
select is((select count(*)::int from public.profiles where id = '33333333-3333-3333-3333-333333333333'), 0, 'profile cascaded');

select * from finish();
rollback;
