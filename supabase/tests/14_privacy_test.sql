begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Privacy audit of 2026-11-05.
insert into auth.users (id, email, encrypted_password) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.fr', extensions.crypt('secret123', extensions.gen_salt('bf'))),
  ('b0000000-0000-0000-0000-000000000002', 'bob@test.fr', ''),
  ('c0000000-0000-0000-0000-000000000003', 'carol@test.fr', '');
insert into public.groups (id, name, invite_code, privacy_contact) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Famille', 'FAM', 'contact famille'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Autre', 'OTHER', 'contact autre');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.login('c0000000-0000-0000-0000-000000000003');
select is(public.join_group('OTHER', 'Carol', '🐼'), 'joined', 'carol joins another group');
select pg_temp.login('b0000000-0000-0000-0000-000000000002');
select is(public.join_group('FAM', 'Bob', '🐯'), 'joined', 'bob joins');
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select is(public.join_group('FAM', 'Alice', '🐉'), 'joined', 'alice joins');

-- what a member sees
select is((select count(*)::int from public.user_stats), 1, 'a member reads only their own stats row');
select is((select count(*)::int from public.leaderboard), 2, 'the leaderboard shows the group');
select is((select count(*)::int from public.leaderboard where pseudo = 'Carol'), 0, 'and no other group');
select is((select privacy_contact from public.groups), 'contact famille', 'a member reads the contact of their group');
select throws_ok($$ select invite_code from public.groups $$, '42501', null, 'not the invite code');

-- export
insert into public.content_reports (user_id, ref_id, message) values (auth.uid(), 'l01', 'typo');
select is((public.export_my_data()->'account'->>'email'), 'alice@test.fr', 'the export holds the e-mail');
select is((public.export_my_data()->'profile'->>'pseudo'), 'Alice', 'the profile');
select is(json_array_length(public.export_my_data()->'content_reports'), 1, 'and the reports');
select is(public.export_my_data()::text like '%Bob%', false, 'nothing about anyone else');

-- anonymous visitors
reset role;
set local role anon;
select throws_ok($$ select public.export_my_data() $$, '42501', null, 'anon cannot export');
select is((select count(*)::int from public.groups), 0, 'anon reads no group');
reset role;

-- deletion
select pg_temp.login('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.delete_my_account('nope') $$, 'P0001', 'wrong_password', 'a wrong password keeps the account');
select throws_ok($$ select public.delete_my_account() $$, 'P0001', 'wrong_password', 'no password keeps the account');
select lives_ok($$ select public.delete_my_account('secret123') $$, 'the right password deletes it');
reset role;
select is((select count(*)::int from public.content_reports), 0, 'reports leave with their author');

select * from finish();
rollback;
