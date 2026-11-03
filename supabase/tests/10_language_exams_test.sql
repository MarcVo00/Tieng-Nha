begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Exam and boss per language (Tagalog spec 2026-11-02 §4.5): 3 attempts per day and per language, one best score
-- per language, Vietnamese untouched. Mirrored by src/services/wallet.test.ts and src/services/progress.test.ts.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.fr');
insert into public.groups (id, name, invite_code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- starts an attempt in `lang` (null = the no-argument call), remembers its id under t.<name>, returns remaining_today
create function pg_temp.start(name text, lang text) returns int language plpgsql as $$
declare r json;
begin
  r := case when lang is null then public.start_exam_attempt() else public.start_exam_attempt(lang) end;
  perform set_config('t.' || name, r->>'attempt_id', true);
  return (r->>'remaining_today')::int;
end $$;
create function pg_temp.finish(name text, score int) returns void language sql as $$
  insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), 'exam_finished', 'exam', 100,
    json_build_object('score', score, 'attemptId', current_setting('t.' || name), 'noSpeaking', false)::jsonb, now())
$$;
create function pg_temp.stats() returns public.user_stats language sql as $$
  select * from public.user_stats where user_id = auth.uid()
$$;

select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
select is((pg_temp.stats()).exam_bests, '{}'::jsonb, 'a new player has no best score in another language');

-- attempts per language
select is(pg_temp.start('v1', null), 2, 'the no-argument call still starts an attempt');
select is((select language from public.exam_attempts where id = current_setting('t.v1')::uuid), 'vi', 'and it is Vietnamese');
select is(pg_temp.start('t1', 'tl'), 2, 'Tagalog has its own 3 attempts');
select is(pg_temp.start('t2', 'tl'), 1, 'second Tagalog attempt');
select is(pg_temp.start('t3', 'tl'), 0, 'third Tagalog attempt');
select throws_ok($$ select pg_temp.start('t4', 'tl') $$, 'P0001', 'exam_limit', 'a 4th Tagalog attempt is refused');
select is(pg_temp.start('v2', 'vi'), 1, 'Vietnamese attempts are counted apart');
select throws_ok($$ select public.start_exam_attempt('fr') $$, 'P0001', 'invalid_language', 'an unknown language is refused');
select throws_ok($$ select public.start_exam_attempt(null) $$, 'P0001', 'invalid_language', 'a null language is refused');

-- a Tagalog win: its own best score, XP and the first-win xu, Vietnamese untouched
select lives_ok($$ select pg_temp.finish('t1', 85) $$, 'scoring a Tagalog attempt never raises');
select is((pg_temp.stats()).exam_bests, '{"tl": 85}'::jsonb, 'the Tagalog best score is kept in exam_bests');
select is((pg_temp.stats()).exam_best, null, 'the Vietnamese best score does not move');
select is((pg_temp.stats()).xp_total, 85, 'the XP is the gain over the Tagalog best (client xp ignored)');
select is((pg_temp.stats()).coins, 50, 'a first Tagalog win pays the first-win 50 xu');

-- a lower Tagalog score: no XP, the best stays, a later win pays 20
select lives_ok($$ select pg_temp.finish('t2', 78) $$, 'a lower Tagalog win is scored');
select is((pg_temp.stats()).exam_bests, '{"tl": 85}'::jsonb, 'the Tagalog best stays the highest');
select is((pg_temp.stats()).coins, 70, 'a later Tagalog win pays 20');
select is((pg_temp.stats()).xp_total, 85, 'no XP below the Tagalog best');

-- then a Vietnamese win is a first win of its own
select lives_ok($$ select pg_temp.finish('v1', 92) $$, 'the Vietnamese attempt is scored');
select is((pg_temp.stats()).exam_best, 92, 'the Vietnamese best is exam_best');
select is((pg_temp.stats()).coins, 120, 'the first Vietnamese win pays 50 even after a Tagalog win');

-- the leaderboard shows both
select is((select exam_bests from public.leaderboard where user_id = auth.uid()), '{"tl": 85}'::jsonb, 'the leaderboard carries exam_bests');

select * from finish();
rollback;
