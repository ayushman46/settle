-- Settle accounts: the rules that must hold whatever the caller sends. Called only by the
-- `settle-api` Edge Function (service role); nobody else may execute them.

-- A fixed-window counter. True while the key is within its allowance.
create function public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql set search_path = '' as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

create function public.is_active_member(p_group uuid, p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = p_user and m.left_at is null
  )
$$;

-- Each person's position in a group, in paise. net > 0: the group owes them.
-- Only confirmed settlements move balances; open ones are reported beside them.
create function public.group_balances(p_group uuid)
returns table (user_id uuid, net bigint, open_out bigint, open_in bigint)
language sql stable set search_path = '' as $$
  with people as (
    select m.user_id from public.group_members m where m.group_id = p_group
  ),
  paid as (
    select e.payer_id as user_id, sum(e.amount_paise) as v
    from public.expenses e where e.group_id = p_group and e.deleted_at is null group by e.payer_id
  ),
  owed as (
    select s.user_id, sum(s.share_paise) as v
    from public.expense_splits s join public.expenses e on e.id = s.expense_id
    where e.group_id = p_group and e.deleted_at is null group by s.user_id
  ),
  sent as (
    select t.sender_id as user_id, sum(t.amount_paise) as v
    from public.settlements t where t.group_id = p_group and t.status = 'confirmed' group by t.sender_id
  ),
  received as (
    select t.receiver_id as user_id, sum(t.amount_paise) as v
    from public.settlements t where t.group_id = p_group and t.status = 'confirmed' group by t.receiver_id
  ),
  open_sent as (
    select t.sender_id as user_id, sum(t.amount_paise) as v
    from public.settlements t where t.group_id = p_group and t.status not in ('confirmed', 'cancelled') group by t.sender_id
  ),
  open_received as (
    select t.receiver_id as user_id, sum(t.amount_paise) as v
    from public.settlements t where t.group_id = p_group and t.status not in ('confirmed', 'cancelled') group by t.receiver_id
  )
  select p.user_id,
    (coalesce(pd.v, 0) - coalesce(ow.v, 0) + coalesce(se.v, 0) - coalesce(re.v, 0))::bigint,
    coalesce(os.v, 0)::bigint,
    coalesce(orc.v, 0)::bigint
  from people p
  left join paid pd on pd.user_id = p.user_id
  left join owed ow on ow.user_id = p.user_id
  left join sent se on se.user_id = p.user_id
  left join received re on re.user_id = p.user_id
  left join open_sent os on os.user_id = p.user_id
  left join open_received orc on orc.user_id = p.user_id
$$;

-- Checks a set of shares against the group and the total; raises on anything wrong.
create function public.check_splits(p_group uuid, p_amount bigint, p_splits jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  v_sum bigint := 0;
  v_count integer := 0;
  v_distinct integer;
  v_item jsonb;
  v_user uuid;
  v_share bigint;
begin
  if jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'splits_empty';
  end if;
  for v_item in select * from jsonb_array_elements(p_splits) loop
    v_user := (v_item ->> 'user_id')::uuid;
    v_share := (v_item ->> 'share_paise')::bigint;
    if v_share is null or v_share < 0 then raise exception 'split_negative'; end if;
    if not public.is_active_member(p_group, v_user) then raise exception 'split_not_member'; end if;
    v_sum := v_sum + v_share;
    v_count := v_count + 1;
  end loop;
  select count(distinct (x ->> 'user_id')) into v_distinct from jsonb_array_elements(p_splits) x;
  if v_distinct <> v_count then raise exception 'split_duplicate'; end if;
  if v_sum <> p_amount then raise exception 'split_sum_mismatch'; end if;
end $$;

create function public.create_expense(
  p_group uuid, p_actor uuid, p_payer uuid, p_amount bigint, p_description text,
  p_category text, p_method text, p_splits jsonb
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_active_member(p_group, p_actor) then raise exception 'not_member'; end if;
  if not public.is_active_member(p_group, p_payer) then raise exception 'payer_not_member'; end if;
  perform public.check_splits(p_group, p_amount, p_splits);
  insert into public.expenses (group_id, payer_id, amount_paise, description, category, split_method, created_by)
  values (p_group, p_payer, p_amount, p_description, p_category, p_method, p_actor)
  returning id into v_id;
  insert into public.expense_splits (expense_id, user_id, share_paise)
  select v_id, (x ->> 'user_id')::uuid, (x ->> 'share_paise')::bigint from jsonb_array_elements(p_splits) x;
  update public.groups set updated_at = now() where id = p_group;
  insert into public.audit_log (user_id, action, detail)
  values (p_actor, 'expense.create', jsonb_build_object('expense_id', v_id, 'group_id', p_group, 'amount_paise', p_amount));
  return v_id;
end $$;

-- Who may change an expense: whoever added it, whoever paid it, or the group's owner.
create function public.can_edit_expense(p_expense uuid, p_actor uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense and e.deleted_at is null
      and public.is_active_member(e.group_id, p_actor)
      and (e.created_by = p_actor or e.payer_id = p_actor or exists (
        select 1 from public.group_members m
        where m.group_id = e.group_id and m.user_id = p_actor and m.role = 'owner' and m.left_at is null
      ))
  )
$$;

create function public.update_expense(
  p_expense uuid, p_actor uuid, p_payer uuid, p_amount bigint, p_description text,
  p_category text, p_method text, p_splits jsonb
) returns void language plpgsql set search_path = '' as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.expenses where id = p_expense for update;
  if v_group is null then raise exception 'not_found'; end if;
  if not public.can_edit_expense(p_expense, p_actor) then raise exception 'forbidden'; end if;
  if not public.is_active_member(v_group, p_payer) then raise exception 'payer_not_member'; end if;
  perform public.check_splits(v_group, p_amount, p_splits);
  update public.expenses set payer_id = p_payer, amount_paise = p_amount, description = p_description,
    category = p_category, split_method = p_method, updated_at = now()
  where id = p_expense;
  delete from public.expense_splits where expense_id = p_expense;
  insert into public.expense_splits (expense_id, user_id, share_paise)
  select p_expense, (x ->> 'user_id')::uuid, (x ->> 'share_paise')::bigint from jsonb_array_elements(p_splits) x;
  update public.groups set updated_at = now() where id = v_group;
  insert into public.audit_log (user_id, action, detail)
  values (p_actor, 'expense.update', jsonb_build_object('expense_id', p_expense, 'amount_paise', p_amount));
end $$;

create function public.delete_expense(p_expense uuid, p_actor uuid)
returns void language plpgsql set search_path = '' as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.expenses where id = p_expense for update;
  if v_group is null then raise exception 'not_found'; end if;
  if not public.can_edit_expense(p_expense, p_actor) then raise exception 'forbidden'; end if;
  update public.expenses set deleted_at = now(), deleted_by = p_actor where id = p_expense;
  update public.groups set updated_at = now() where id = v_group;
  insert into public.audit_log (user_id, action, detail)
  values (p_actor, 'expense.delete', jsonb_build_object('expense_id', p_expense));
end $$;

-- A settlement can't be for more than the sender still owes or the receiver is still owed,
-- counting settlements already in progress. The same idempotency key returns the same record.
create function public.create_settlement(
  p_group uuid, p_sender uuid, p_receiver uuid, p_amount bigint, p_idempotency_key text
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_sender record;
  v_receiver record;
begin
  select id into v_id from public.settlements where sender_id = p_sender and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if p_sender = p_receiver then raise exception 'same_person'; end if;
  if not public.is_active_member(p_group, p_sender) then raise exception 'not_member'; end if;
  if not public.is_active_member(p_group, p_receiver) then raise exception 'receiver_not_member'; end if;
  -- One settlement decision per group at a time, so two taps can't both pass the check below.
  perform pg_advisory_xact_lock(hashtextextended(p_group::text, 0));
  select * into v_sender from public.group_balances(p_group) b where b.user_id = p_sender;
  select * into v_receiver from public.group_balances(p_group) b where b.user_id = p_receiver;
  if p_amount <= 0 or p_amount > (-v_sender.net - v_sender.open_out) then raise exception 'more_than_owed'; end if;
  if p_amount > (v_receiver.net - v_receiver.open_in) then raise exception 'more_than_due'; end if;
  insert into public.settlements (group_id, sender_id, receiver_id, amount_paise, idempotency_key)
  values (p_group, p_sender, p_receiver, p_amount, p_idempotency_key)
  returning id into v_id;
  insert into public.settlement_events (settlement_id, actor_id, event_type, to_status, event_data)
  values (v_id, p_sender, 'created', 'pending', jsonb_build_object('amount_paise', p_amount));
  return v_id;
end $$;

-- The payer starts paying: one attempt per idempotency key. Returns the attempt's id.
create function public.start_settlement_attempt(
  p_settlement uuid, p_actor uuid, p_idempotency_key text, p_payment_method uuid, p_upi_id text
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_row public.settlements;
  v_attempt uuid;
begin
  select * into v_row from public.settlements where id = p_settlement for update;
  if v_row.id is null then raise exception 'not_found'; end if;
  if v_row.sender_id <> p_actor then raise exception 'forbidden'; end if;
  select id into v_attempt from public.settlement_attempts where idempotency_key = p_idempotency_key;
  if v_attempt is not null then
    if not exists (select 1 from public.settlement_attempts where id = v_attempt and settlement_id = p_settlement) then
      raise exception 'idempotency_conflict';
    end if;
    return v_attempt;
  end if;
  if v_row.status not in ('pending', 'initiated', 'failed', 'disputed') then raise exception 'bad_state'; end if;
  update public.settlement_attempts set result_status = 'cancelled', result_at = now()
  where settlement_id = p_settlement and result_status = 'initiated';
  insert into public.settlement_attempts (settlement_id, idempotency_key, payment_method_id, upi_id)
  values (p_settlement, p_idempotency_key, p_payment_method, p_upi_id)
  returning id into v_attempt;
  update public.settlements set status = 'initiated', payment_method_id = p_payment_method, updated_at = now()
  where id = p_settlement;
  insert into public.settlement_events (settlement_id, actor_id, event_type, from_status, to_status, event_data)
  values (p_settlement, p_actor, 'initiated', v_row.status, 'initiated',
    jsonb_build_object('attempt_id', v_attempt, 'payment_method_id', p_payment_method));
  return v_attempt;
end $$;

-- Every other move. The payer reports what happened in their UPI app; only the receiver can
-- confirm money arrived (or later reverse a confirmation they got wrong). Returns the new status.
create function public.settlement_transition(p_settlement uuid, p_actor uuid, p_action text, p_data jsonb)
returns text language plpgsql set search_path = '' as $$
declare
  v_row public.settlements;
  v_to text;
  v_ref text := nullif(trim(coalesce(p_data ->> 'transaction_reference', '')), '');
begin
  select * into v_row from public.settlements where id = p_settlement for update;
  if v_row.id is null then raise exception 'not_found'; end if;

  if p_action in ('sent', 'failed', 'cancel') then
    if v_row.sender_id <> p_actor then raise exception 'forbidden'; end if;
  elsif p_action in ('confirm', 'dispute', 'reverse') then
    if v_row.receiver_id <> p_actor then raise exception 'forbidden'; end if;
  else
    raise exception 'bad_action';
  end if;

  v_to := case
    when p_action = 'sent' and v_row.status in ('pending', 'initiated', 'failed', 'disputed') then 'awaiting_confirmation'
    when p_action = 'failed' and v_row.status = 'initiated' then 'failed'
    when p_action = 'cancel' and v_row.status in ('pending', 'initiated', 'failed', 'disputed') then 'cancelled'
    when p_action = 'confirm' and v_row.status in ('pending', 'initiated', 'awaiting_confirmation', 'failed', 'disputed') then 'confirmed'
    when p_action = 'dispute' and v_row.status = 'awaiting_confirmation' then 'disputed'
    when p_action = 'reverse' and v_row.status = 'confirmed' then 'disputed'
    else null
  end;
  if v_to is null then raise exception 'bad_state'; end if;
  if p_action = 'reverse' and nullif(trim(coalesce(p_data ->> 'reason', '')), '') is null then
    raise exception 'reason_required';
  end if;

  if p_action in ('sent', 'failed', 'cancel') then
    update public.settlement_attempts
    set result_status = case p_action when 'sent' then 'sent' when 'failed' then 'failed' else 'cancelled' end,
        result_at = now(),
        transaction_reference = coalesce(v_ref, transaction_reference)
    where id = (
      select a.id from public.settlement_attempts a
      where a.settlement_id = p_settlement and a.result_status = 'initiated'
      order by a.initiated_at desc limit 1
    );
  end if;

  update public.settlements set status = v_to, updated_at = now() where id = p_settlement;
  insert into public.settlement_events (settlement_id, actor_id, event_type, from_status, to_status, event_data)
  values (p_settlement, p_actor, case p_action when 'reverse' then 'reversed' else p_action end, v_row.status, v_to,
    coalesce(p_data, '{}'::jsonb));
  return v_to;
end $$;

-- Nobody but the server's own role runs these.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'hit_rate_limit', 'is_active_member', 'group_balances', 'check_splits', 'create_expense',
      'can_edit_expense', 'update_expense', 'delete_expense', 'create_settlement',
      'start_settlement_attempt', 'settlement_transition'
    )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
