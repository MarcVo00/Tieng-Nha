begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- Daily bonus (daily bonus spec 2026-10-29 §3): one bonus per Paris day, a 7-day run 10,10,15,15,20,20,50,
-- never XP, never the learning streak. Mirrored by src/services/wallet.test.ts.
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

-- a bonus event for day `r`, created `ago` days before now
create function pg_temp.claim(r text, ago int default 0) returns void
language sql as $$
  insert into public.events (client_id, user_id, type, ref_id, xp, payload, client_created_at)
  values (gen_random_uuid(), auth.uid(), 'daily_bonus_claimed', r, 0, '{"day": 7, "coins": 999}', now() - make_interval(days => ago))
$$;
create function pg_temp.day(ago int) returns text language sql as $$
  select (public.paris_today() - ago)::text
$$;
create function pg_temp.coins() returns int language sql as $$
  select coins from public.user_stats where user_id = auth.uid()
$$;
create function pg_temp.run() returns int language sql as $$
  select bonus_streak from public.user_stats where user_id = auth.uid()
$$;
create function pg_temp.last() returns date language sql as $$
  select bonus_day from public.user_stats where user_id = auth.uid()
$$;
-- as postgres: set the wallet and the run of alice
create function pg_temp.set_run(c int, d date, n int) returns void language sql as $$
  update public.user_stats set coins = c, bonus_day = d, bonus_streak = n
  where user_id = 'a0000000-0000-0000-0000-000000000001'
$$;

-- pure amount rule
select is(public.daily_bonus_amount(1), 10, 'day 1 pays 10');
select is(public.daily_bonus_amount(2), 10, 'day 2 pays 10');
select is(public.daily_bonus_amount(3), 15, 'day 3 pays 15');
select is(public.daily_bonus_amount(4), 15, 'day 4 pays 15');
select is(public.daily_bonus_amount(5), 20, 'day 5 pays 20');
select is(public.daily_bonus_amount(6), 20, 'day 6 pays 20');
select is(public.daily_bonus_amount(7), 50, 'day 7 pays 50');
select is(public.daily_bonus_amount(8), null, 'no day 8');
select ok(not has_function_privilege('authenticated', 'public.daily_bonus_amount(int)', 'execute'), 'clients cannot call the amount rule');

select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.join_group('FAM', 'Alice', '🐉') $$, 'alice joins');
select is(pg_temp.run(), 0, 'a new player has no run');

-- first claim, today
select lives_ok($$ select pg_temp.claim(pg_temp.day(0)) $$, 'claiming today never raises');
select is(pg_temp.coins(), 10, 'the first bonus pays 10 (the payload amount is ignored)');
select is(pg_temp.run(), 1, 'the run starts at day 1');
select is(pg_temp.last()::text, pg_temp.day(0), 'today is recorded');
select is((select xp_total from public.user_stats where user_id = auth.uid()), 0, 'no XP');
select is((select streak from public.user_stats where user_id = auth.uid()), 0, 'the learning streak is unchanged');
select is((select last_active_day from public.user_stats where user_id = auth.uid()), null, 'not an active learning day');

-- a second claim the same day pays nothing
select pg_temp.claim(pg_temp.day(0));
select is(pg_temp.coins(), 10, 'a second claim the same day pays nothing');
select is(pg_temp.run(), 1, 'and keeps the run');

-- yesterday then today: the run goes on
reset role;
select pg_temp.set_run(0, null, 0);
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.claim(pg_temp.day(1), 1);
select is(pg_temp.coins(), 10, 'an offline claim of yesterday synced today pays');
select pg_temp.claim(pg_temp.day(0));
select is(pg_temp.coins(), 20, 'the next day pays day 2');
select is(pg_temp.run(), 2, 'the run is at day 2');

-- the amount follows the run
reset role;
select pg_temp.set_run(0, current_date, 3);
update public.user_stats set bonus_day = public.paris_today() - 1 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.claim(pg_temp.day(0));
select is(pg_temp.coins(), 15, 'day 4 pays 15');

-- after day 7 the run restarts
reset role;
select pg_temp.set_run(0, current_date, 6);
update public.user_stats set bonus_day = public.paris_today() - 1 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.claim(pg_temp.day(0));
select is(pg_temp.coins(), 50, 'day 7 pays 50');
reset role;
update public.user_stats set bonus_day = public.paris_today() - 1 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.claim(pg_temp.day(0));
select is(pg_temp.run(), 1, 'after day 7 the run restarts at day 1');
select is(pg_temp.coins(), 60, 'and pays 10');

-- a missed day restarts the run
reset role;
select pg_temp.set_run(0, current_date, 5);
update public.user_stats set bonus_day = public.paris_today() - 3 where user_id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select pg_temp.claim(pg_temp.day(0));
select is(pg_temp.run(), 1, 'a missed day restarts the run');
select is(pg_temp.coins(), 10, 'at 10');

-- refusals: none credits, none raises
reset role;
select pg_temp.set_run(0, null, 0);
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select pg_temp.claim(pg_temp.day(2), 2) $$, 'a back-dated claim never raises');
select is(pg_temp.coins(), 0, 'a claim older than yesterday pays nothing');
select pg_temp.claim(pg_temp.day(1));
select is(pg_temp.coins(), 0, 'a ref_id other than the event day pays nothing');
select pg_temp.claim(pg_temp.day(-1), -1);
select is(pg_temp.coins(), 0, 'a future day pays nothing (the event day is capped at now)');
select lives_ok($$ select pg_temp.claim('2026-13-45') $$, 'an impossible date never raises');
select lives_ok($$ select pg_temp.claim('not-a-day') $$, 'a non-date never raises');
select is(pg_temp.coins(), 0, 'and they pay nothing');

select * from finish();
rollback;
