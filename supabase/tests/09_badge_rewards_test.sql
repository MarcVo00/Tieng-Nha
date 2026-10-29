begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Badge rewards (energy and badge rewards spec 2026-10-29 §2): each badge pays its own amount once, an unknown id pays 0.
-- Mirrored by src/services/wallet.test.ts; the amounts by src/content/shopParity.test.ts.
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
create function pg_temp.badge(r text) returns void language sql as $$
  insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), 'badge_unlocked', r, 0, '{}', now())
$$;
create function pg_temp.coins() returns int language sql as $$
  select coins from public.user_stats where user_id = auth.uid()
$$;

select is(public.badge_coins('first_lesson'), 20, 'first_lesson pays 20');
select is(public.badge_coins('streak_30'), 200, 'streak_30 pays 200');
select is(public.badge_coins('xp_3000'), 200, 'a new badge has its amount');
select is(public.badge_coins('forged'), 0, 'an unknown badge pays 0');
select is((select count(*)::int from (values ('first_lesson'), ('three_lessons'), ('five_lessons'), ('ten_lessons'), ('streak_3'),
  ('streak_7'), ('streak_14'), ('streak_30'), ('perfect_lesson'), ('perfect_5'), ('perfect_10'), ('vocab_25'), ('vocab_100'),
  ('vocab_250'), ('first_dialogue'), ('five_dialogues'), ('all_dialogues'), ('exam_passed'), ('exam_excellent'), ('xp_500'),
  ('xp_1500'), ('xp_3000'), ('days_10'), ('days_30')) as v(id) where public.badge_coins(v.id) between 20 and 200), 24,
  'the 24 badges pay between 20 and 200');
select ok(not has_function_privilege('authenticated', 'public.badge_coins(text)', 'execute'), 'clients cannot call badge_coins');

select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
select pg_temp.badge('ten_lessons');
select is(pg_temp.coins(), 100, 'a badge pays its own amount');
select pg_temp.badge('ten_lessons');
select is(pg_temp.coins(), 100, 'a badge pays only once');
select lives_ok($$ select pg_temp.badge('forged') $$, 'an unknown badge never raises');
select is(pg_temp.coins(), 100, 'and pays nothing');
select is((select inventory from public.user_stats where user_id = auth.uid()), array['frame_jade'], 'the reward item is still granted');

select * from finish();
rollback;
