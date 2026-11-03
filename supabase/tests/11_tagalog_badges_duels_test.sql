begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Tagalog badges and duels per language (Tagalog spec 2026-11-02 §4.5, §4.6). Mirrored by src/services/badges.test.ts,
-- src/services/duel.test.ts and src/content/shopParity.test.ts.
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
-- n questions of the lessons <prefix>l01/<prefix>l02
create function pg_temp.q(prefix text, n1 int, n2 int) returns jsonb language sql as $$
  select jsonb_build_object(
    'round1', (select jsonb_agg(jsonb_build_object('lessonId', prefix || case when i % 2 = 0 then 'l01' else 'l02' end, 'exerciseId', 'ex' || i)) from generate_series(1, n1) i),
    'round2', (select jsonb_agg(jsonb_build_object('lessonId', prefix || 'l01', 'exerciseId', 'sp' || i)) from generate_series(1, n2) i))
$$;
create function pg_temp.err(j json) returns text language sql as $$ select j->>'error' $$;
-- remembers a created duel under t.<name> (duels are RPC-only: its language is read back as postgres)
create function pg_temp.keep(name text, j json) returns boolean language plpgsql as $$
begin
  perform set_config('t.' || name, coalesce(j->>'duelId', ''), true);
  return (j->>'ok')::boolean;
end $$;
create function pg_temp.coins() returns int language sql as $$
  select coins from public.user_stats where user_id = auth.uid()
$$;

-- ---------- badges ----------
select is(public.badge_coins('tl_first_lesson'), 20, 'tl_first_lesson pays 20');
select is(public.badge_coins('tl_perfect_all'), 120, 'tl_perfect_all pays 120');
select is(public.badge_coins('tl_exam_excellent'), 150, 'tl_exam_excellent pays 150');
select is(public.badge_coins('ten_lessons'), 100, 'the Vietnamese amounts are unchanged');
select is(public.badge_coins('tl_nope'), 0, 'an unknown Tagalog id pays nothing');
select is(public.language_of_id('tl_l01'), 'tl', 'tl_ ids are Tagalog');
select is(public.language_of_id('l01'), 'vi', 'unprefixed ids are Vietnamese');
select is(public.language_of_id('tlx01'), 'vi', 'only the exact tl_ prefix is Tagalog');

select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
values (gen_random_uuid(), auth.uid(), 'badge_unlocked', 'tl_all_lessons', 0, '{}', now());
select is(pg_temp.coins(), 100, 'unlocking tl_all_lessons pays its 100 xu');

select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.join_group('FAM', 'Bob', '🐲') $$, 'bob joins');
reset role;
-- both have the Vietnamese prerequisites; for Tagalog, only alice and bob's first lesson (no dialogue yet)
update public.user_stats set lessons_done = '{l01,l02,tl_l01,tl_l02}', dialogues_done = '{d01,tl_d01}'
  where user_id = 'a0000000-0000-0000-0000-000000000001';
update public.user_stats set lessons_done = '{l01,l02,tl_l01,tl_l02}', dialogues_done = '{d01}'
  where user_id = 'b0000000-0000-0000-0000-000000000002';

-- ---------- duels per language ----------
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q('tl_', 8, 3), 1, 'tl')), 'prerequisites',
  'a Tagalog duel needs the first Tagalog dialogue on both sides');
reset role;
update public.user_stats set dialogues_done = '{d01,tl_d01}' where user_id = 'b0000000-0000-0000-0000-000000000002';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q('', 8, 3), 1, 'tl')), 'not_common_lesson',
  'a Tagalog duel refuses Vietnamese questions');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q('tl_', 8, 3), 1, 'fr')), 'bad_questions',
  'an unknown language is refused');
select ok(pg_temp.keep('tl', public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q('tl_', 8, 3), 1, 'tl')),
  'a Tagalog duel is created');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q('tl_', 8, 3), 2, 'tl')), 'already_open',
  'one open Tagalog duel per pair');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q('tl_', 8, 3), 2)), 'not_common_lesson',
  'the call without language (apps before 2.2) is Vietnamese: Tagalog questions are refused');
select ok(pg_temp.keep('vi', public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q('', 8, 3), 3)),
  'a Vietnamese duel can be open beside the Tagalog one');
select is(pg_temp.err(public.create_duel('b0000000-0000-0000-0000-000000000002', pg_temp.q('', 8, 3), 4, 'vi')), 'already_open',
  'one open Vietnamese duel per pair');
reset role;
select is((select language from public.duels where id = current_setting('t.tl')::uuid), 'tl', 'the Tagalog duel is stored as Tagalog');
select is((select language from public.duels where id = current_setting('t.vi')::uuid), 'vi', 'the call without language stores a Vietnamese duel');
select is((select count(*)::int from public.duels where challenger = 'a0000000-0000-0000-0000-000000000001'), 2, 'two duels created today, counted together');

select * from finish();
rollback;
