-- The database's own rules, checked on a fresh Postgres with every migration applied (CI: the
-- "Database" job). Each block runs in a transaction that is rolled back; a broken rule fails an
-- ASSERT and stops the run.
--
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/settle.sql

\set QUIET on

-- Shares, settlements and the settlement state machine.
begin;
do $$
declare
  a uuid; r uuid; j uuid; g uuid; s uuid; att uuid; st text; b record; failed boolean;
begin
  insert into public.profiles (display_name, phone_number) values ('Ayush', '+919800000001') returning id into a;
  insert into public.profiles (display_name, phone_number) values ('Rahul', '+919800000002') returning id into r;
  insert into public.profiles (display_name, phone_number) values ('Rajeev', '+919800000003') returning id into j;
  insert into public.groups (name, created_by) values ('Dinner', a) returning id into g;
  insert into public.group_members (group_id, user_id, role) values (g, a, 'owner'), (g, r, 'member'), (g, j, 'member');

  perform public.create_expense(g, a, a, 150000, 'Dinner', null, 'equal', jsonb_build_array(
    jsonb_build_object('user_id', a, 'share_paise', 50000),
    jsonb_build_object('user_id', r, 'share_paise', 50000),
    jsonb_build_object('user_id', j, 'share_paise', 50000)));
  select * into b from public.group_balances(g) where user_id = a;
  assert b.net = 100000, 'the payer is owed 1000 rupees';
  select * into b from public.group_balances(g) where user_id = r;
  assert b.net = -50000, 'Rahul owes 500 rupees';

  failed := false;
  begin
    perform public.create_expense(g, a, a, 150000, 'Bad', null, 'equal', jsonb_build_array(jsonb_build_object('user_id', a, 'share_paise', 100)));
  exception when others then failed := sqlerrm = 'split_sum_mismatch';
  end;
  assert failed, 'shares that do not add up are refused';

  failed := false;
  begin
    perform public.create_settlement(g, r, a, 60000, 'idem-overpay');
  exception when others then failed := sqlerrm = 'more_than_owed';
  end;
  assert failed, 'paying more than you owe is refused';

  s := public.create_settlement(g, r, a, 50000, 'idem-rahul-1');
  assert public.create_settlement(g, r, a, 50000, 'idem-rahul-1') = s, 'the same idempotency key returns the same settlement';

  failed := false;
  begin
    perform public.create_settlement(g, r, a, 1, 'idem-rahul-2');
  exception when others then failed := sqlerrm = 'more_than_owed';
  end;
  assert failed, 'a payment in progress counts against what is owed';

  att := public.start_settlement_attempt(s, r, 'attempt-key-1', null, 'ayush@oksbi');
  assert public.start_settlement_attempt(s, r, 'attempt-key-1', null, 'ayush@oksbi') = att, 'the same attempt key returns the same attempt';

  failed := false;
  begin
    perform public.settlement_transition(s, r, 'confirm', '{}'::jsonb);
  exception when others then failed := sqlerrm = 'forbidden';
  end;
  assert failed, 'the payer cannot confirm their own payment';

  st := public.settlement_transition(s, r, 'sent', '{"transaction_reference":"412345678901"}'::jsonb);
  assert st = 'awaiting_confirmation', 'sent waits for the receiver';
  select * into b from public.group_balances(g) where user_id = r;
  assert b.net = -50000, 'nothing moves until the receiver confirms';
  st := public.settlement_transition(s, a, 'dispute', '{"reason":"not received"}'::jsonb);
  assert st = 'disputed';
  st := public.settlement_transition(s, a, 'confirm', '{}'::jsonb);
  assert st = 'confirmed';
  select * into b from public.group_balances(g) where user_id = r;
  assert b.net = 0, 'a confirmed payment settles the balance';

  failed := false;
  begin
    perform public.settlement_transition(s, a, 'reverse', '{}'::jsonb);
  exception when others then failed := sqlerrm = 'reason_required';
  end;
  assert failed, 'undoing a confirmation needs a reason';

  failed := false;
  begin
    update public.settlement_events set event_type = 'x' where settlement_id = s;
  exception when others then failed := true;
  end;
  assert failed, 'settlement history cannot be rewritten';
  assert (select count(*) from public.settlement_events where settlement_id = s) = 5, 'every step is recorded';
end $$;
rollback;

-- A person's own data: newer change wins, deletions travel, pulls page.
begin;
do $$
declare u uuid; n integer; p jsonb;
begin
  insert into public.profiles (display_name, phone_number) values ('Sync', '+919800000009') returning id into u;
  n := public.sync_push(u, '{
    "friends": [{"id":"me","name":"Me","createdAt":1,"lastUsedAt":1,"updatedAt":10},{"id":"f1","name":"Riya","createdAt":1,"lastUsedAt":1,"updatedAt":10}],
    "groups": [{"id":"g1","name":"Goa","kind":"trip","currency":"INR","memberIds":["me","f1"],"settlements":[{"id":"s1","fromId":"f1","toId":"me","amount":50000,"date":"2026-11-16","method":"upi","createdAt":5}],"createdAt":1,"updatedAt":10}],
    "expenses": [{"id":"e1","title":"Dinner","category":"food","currency":"INR","total":150000,"date":"2026-11-16","payerId":"me","mode":"equal","shares":{"me":75000,"f1":75000},"groupId":"g1","createdAt":1,"updatedAt":10}],
    "stores": [{"key":"settle.v10.tally","data":{"v":1,"data":[]},"updatedAt":10},{"key":"settle-proof-refs","data":{"v":1,"data":[]},"updatedAt":10}]
  }'::jsonb);
  assert n = 6, format('six rows written, got %s', n);

  n := public.sync_push(u, '{"expenses":[{"id":"e1","title":"OLD","total":1,"updatedAt":5,"shares":{"me":1}}]}'::jsonb);
  assert n = 0, 'an older change does not win';
  assert (select title from public.user_expenses where id = 'e1') = 'Dinner';

  n := public.sync_push(u, '{"expenses":[{"id":"e1","title":"Dinner+","category":"food","currency":"INR","total":180000,"date":"2026-11-16","payerId":"me","mode":"equal","shares":{"me":90000,"f1":90000},"createdAt":1,"updatedAt":20}],
    "groups":[{"id":"g1","name":"Goa","kind":"trip","currency":"INR","updatedAt":20,"deleted":true}]}'::jsonb);
  assert (select sum(share) from public.user_expense_shares where expense_id = 'e1') = 180000, 'shares are replaced with their expense';
  assert (select deleted from public.user_groups where id = 'g1'), 'a deletion is kept as a tombstone';
  assert (select count(*) from public.user_group_members where group_id = 'g1') = 0, 'a deleted group keeps no members';

  p := public.sync_pull(u, 0, 500);
  assert jsonb_array_length(p -> 'friends') = 2 and jsonb_array_length(p -> 'stores') = 2;
  assert (p -> 'expenses' -> 0 ->> 'total')::bigint = 180000;
  assert not (p ->> 'more')::boolean;
  assert jsonb_array_length(public.sync_pull(u, (p ->> 'cursor')::bigint, 500) -> 'expenses') = 0, 'nothing new after the cursor';
  assert (public.sync_pull(u, 0, 1) ->> 'more')::boolean, 'a capped pull says there is more';
end $$;
rollback;

-- Deleting an account: refused while money is owed, then nothing personal is left.
begin;
do $$
declare
  a uuid; r uuid; g uuid; solo uuid; s uuid; failed boolean;
begin
  insert into public.profiles (display_name, phone_number) values ('Ayush', '+919800000011') returning id into a;
  insert into public.profiles (display_name, phone_number) values ('Rahul', '+919800000012') returning id into r;
  insert into public.groups (name, created_by) values ('Flat', a) returning id into g;
  insert into public.groups (name, created_by) values ('Just me', a) returning id into solo;
  insert into public.group_members (group_id, user_id, role) values (g, a, 'owner'), (g, r, 'member'), (solo, a, 'owner');
  insert into public.passkey_credentials (user_id, credential_id, public_key) values (a, 'credential-id-for-ayush-01', 'pk');
  insert into public.sessions (user_id, token_hash, expires_at) values (a, 'hash-ayush', now() + interval '1 day');
  insert into public.payment_methods (user_id, upi_id, verification_status, is_default) values (a, 'ayush@oksbi', 'validated', true);
  perform public.sync_push(a, '{"friends":[{"id":"f1","name":"Riya","updatedAt":1}]}'::jsonb);

  perform public.create_expense(g, a, a, 100000, 'Rent', null, 'equal', jsonb_build_array(
    jsonb_build_object('user_id', a, 'share_paise', 50000), jsonb_build_object('user_id', r, 'share_paise', 50000)));

  failed := false;
  begin
    perform public.delete_account(a);
  exception when others then failed := sqlerrm = 'balance_not_zero';
  end;
  assert failed, 'an account that is owed money cannot be deleted';

  s := public.create_settlement(g, r, a, 50000, 'idem-del-1');
  failed := false;
  begin
    perform public.delete_account(a);
  exception when others then failed := sqlerrm = 'balance_not_zero';
  end;
  assert failed, 'nor while a payment to it is in flight';

  perform public.settlement_transition(s, r, 'sent', '{}'::jsonb);
  perform public.settlement_transition(s, a, 'confirm', '{}'::jsonb);
  perform public.delete_account(a);

  assert (select display_name = 'Deleted account' and phone_number is null and deleted_at is not null from public.profiles where id = a), 'the profile keeps no name or number';
  assert not exists (select 1 from public.groups where id = solo), 'a group only they were in is gone';
  assert (select role from public.group_members where group_id = g and user_id = r) = 'owner', 'ownership passes on';
  assert (select left_at is not null from public.group_members where group_id = g and user_id = a), 'they left the shared group';
  assert (select count(*) from public.expenses where group_id = g) = 1, 'shared history stays';
  assert not exists (select 1 from public.passkey_credentials where user_id = a), 'passkeys are gone';
  assert not exists (select 1 from public.sessions where user_id = a), 'sessions are gone';
  assert not exists (select 1 from public.user_friends where user_id = a), 'personal data is gone';
  assert not exists (select 1 from public.payment_methods where user_id = a and verification_status <> 'disabled'), 'no UPI ID can be paid';
  insert into public.profiles (display_name, phone_number) values ('Ayush again', '+919800000011');

  failed := false;
  begin
    perform public.delete_account(a);
  exception when others then failed := sqlerrm = 'not_found';
  end;
  assert failed, 'an account is deleted once';
end $$;
rollback;

-- Nobody but the server's own role can reach the data or run the functions.
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    assert (select relrowsecurity from pg_class where relname = t.relname and relnamespace = 'public'::regnamespace), format('RLS is on for %s', t.relname);
    assert not has_table_privilege('anon', format('public.%I', t.relname), 'select'), format('anon cannot read %s', t.relname);
    assert not has_table_privilege('authenticated', format('public.%I', t.relname), 'select'), format('authenticated cannot read %s', t.relname);
  end loop;
  assert not has_function_privilege('anon', 'public.sync_push(uuid, jsonb)', 'execute'), 'anon cannot run sync_push';
  assert not has_function_privilege('anon', 'public.create_settlement(uuid, uuid, uuid, bigint, text)', 'execute'), 'anon cannot run create_settlement';
  assert not has_function_privilege('anon', 'public.delete_account(uuid)', 'execute'), 'anon cannot run delete_account';
end $$;

\echo 'Database rules: all good.'
