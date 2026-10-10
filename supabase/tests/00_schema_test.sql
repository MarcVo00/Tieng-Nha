begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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

-- join_group
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins FAM');
select throws_ok($$ select public.join_group('NOPE', 'Alice', '🐉') $$, 'P0001', 'invalid_invite', 'bad invite rejected');

-- events → stats, idempotence, exam delta
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'lesson_completed', 'l01', 15, now());
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'lesson_completed', 'l01', 15, now())
on conflict (client_id) do nothing;
select is((select xp_total from public.user_stats where user_id = auth.uid()), 15, 'xp counted once (idempotent)');
select is((select lessons_done from public.user_stats where user_id = auth.uid()), array['l01'], 'lesson recorded');
select is((select streak from public.user_stats where user_id = auth.uid()), 1, 'streak starts at 1');

insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
values (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100, '{"score": 72}', now());
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
values (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100, '{"score": 80}', now());
select is((select xp_total from public.user_stats where user_id = auth.uid()), 15 + 72 + 8, 'exam xp = delta over best, client xp ignored');
select is((select exam_best from public.user_stats where user_id = auth.uid()), 80, 'exam best stored');

-- daily cap (already 95 today): +10 x 12 = 120 → capped at 200 total today
insert into public.events (client_id, user_id, type, ref_id, xp, client_created_at)
select gen_random_uuid(), auth.uid(), 'lesson_completed', 'l0' || g, 10, now() from generate_series(1, 12) g;
select is((select xp_today from public.user_stats where user_id = auth.uid()), 200, 'daily cap 200');

-- clients cannot write stats directly
select throws_ok($$ update public.user_stats set xp_total = 9999 where user_id = auth.uid() $$, '42501', null, 'stats not writable');

-- exam limit
select lives_ok($$ select public.start_exam_attempt() $$, 'attempt 1');
select lives_ok($$ select public.start_exam_attempt() $$, 'attempt 2');
select is((public.start_exam_attempt()->>'remaining_today')::int, 0, 'attempt 3 leaves 0');
select throws_ok($$ select public.start_exam_attempt() $$, 'P0001', 'exam_limit', '4th attempt refused');

-- bob, same group: sees alice's stats, not her events
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select lives_ok($$ select public.join_group('FAM', 'Bob', '🐯') $$, 'bob joins FAM');
select is((select count(*)::int from public.leaderboard), 2, 'bob sees 2 rows in his group leaderboard');
select is((select count(*)::int from public.events), 0, 'bob cannot read alice events');

-- carol, other group: isolated
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select public.join_group('OTHER', 'Carol', '🐼');
select is((select count(*)::int from public.leaderboard), 1, 'carol only sees her own group');

select * from finish();
rollback;
