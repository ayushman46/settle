-- Deleting an account, and passkeys that say which password manager holds them.

-- Which password manager made a passkey (its AAGUID), and which passkey a session signed in with.
alter table public.passkey_credentials add column aaguid text check (aaguid is null or aaguid ~ '^[0-9a-f-]{36}$');
alter table public.sessions add column passkey_id uuid references public.passkey_credentials(id) on delete set null;

-- A deleted account keeps its row as a nameless marker, so other people's shared history still adds
-- up; the number is let go (it can make a new account) and nothing personal is left on it.
alter table public.profiles alter column phone_number drop not null;
alter table public.profiles add column deleted_at timestamptz;
alter table public.profiles add constraint profiles_deleted_has_no_phone check (deleted_at is null or phone_number is null);

/**
 * Deletes an account: refused while it owes or is owed anything in an account group (payments in
 * flight included). Groups only this person was ever in go with it; the others it leaves, handing
 * ownership on. Its personal data (splits, friends, saved settings, UPI IDs, passkeys, sessions,
 * invites) is deleted; shared expenses and payments stay, under "Deleted account".
 */
create or replace function public.delete_account(p_user uuid) returns void language plpgsql set search_path = '' as $$
declare
  v_group uuid;
  v_next uuid;
begin
  perform 1 from public.profiles where id = p_user and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;

  for v_group in select gm.group_id from public.group_members gm where gm.user_id = p_user and gm.left_at is null loop
    if exists (
      select 1 from public.group_balances(v_group) b
      where b.user_id = p_user and (b.net <> 0 or b.open_out <> 0 or b.open_in <> 0)
    ) then
      raise exception 'balance_not_zero';
    end if;
  end loop;

  -- Groups nobody else was ever in: nothing shared to keep.
  delete from public.groups g
  where g.id in (select gm.group_id from public.group_members gm where gm.user_id = p_user)
    and not exists (select 1 from public.group_members o where o.group_id = g.id and o.user_id <> p_user);

  -- The rest: leave, and pass ownership to whoever joined first.
  for v_group in select gm.group_id from public.group_members gm where gm.user_id = p_user and gm.left_at is null and gm.role = 'owner' loop
    select o.id into v_next from public.group_members o
    where o.group_id = v_group and o.user_id <> p_user and o.left_at is null
    order by o.joined_at limit 1;
    if v_next is not null then update public.group_members set role = 'owner' where id = v_next; end if;
  end loop;
  update public.group_members set left_at = now(), role = 'member' where user_id = p_user and left_at is null;

  delete from public.group_invites where created_by = p_user;
  delete from public.user_expenses where user_id = p_user;
  delete from public.user_groups where user_id = p_user;
  delete from public.user_friends where user_id = p_user;
  delete from public.user_stores where user_id = p_user;
  delete from public.webauthn_challenges where user_id = p_user;
  delete from public.sessions where user_id = p_user;
  delete from public.passkey_credentials where user_id = p_user;
  -- UPI IDs a past payment points at stay as that payment's record, switched off; the rest go.
  delete from public.payment_methods pm
  where pm.user_id = p_user
    and not exists (select 1 from public.settlements s where s.payment_method_id = pm.id)
    and not exists (select 1 from public.settlement_attempts a where a.payment_method_id = pm.id);
  update public.payment_methods set verification_status = 'disabled', is_default = false, display_name = null, updated_at = now()
  where user_id = p_user;

  update public.profiles
  set display_name = 'Deleted account', phone_number = null, phone_verified = false, deleted_at = now(), updated_at = now()
  where id = p_user;
end $$;

revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
