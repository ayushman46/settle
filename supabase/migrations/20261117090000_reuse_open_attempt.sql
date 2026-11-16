-- Opening the pay sheet again for a payment already under way (same UPI ID) carries on the same
-- attempt instead of starting another: the record shows one "initiated", not one per opening.
create or replace function public.start_settlement_attempt(
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
  if v_row.status = 'initiated' then
    select a.id into v_attempt from public.settlement_attempts a
    where a.settlement_id = p_settlement and a.result_status = 'initiated' and a.upi_id = p_upi_id
    order by a.initiated_at desc limit 1;
    if v_attempt is not null then return v_attempt; end if;
  end if;
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

revoke execute on function public.start_settlement_attempt(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.start_settlement_attempt(uuid, uuid, text, uuid, text) to service_role;
