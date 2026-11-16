-- Settle accounts: passkey identities, UPI payment destinations, server-side groups, expenses and
-- settlements. Every table has RLS on and no policies: nothing is reachable with the public keys.
-- All reads and writes go through the `settle-api` Edge Function (service role), which checks the
-- session and the caller's membership itself. Money is integer paise throughout.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ identity

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 40),
  phone_number text not null unique check (phone_number ~ '^\+91[6-9][0-9]{9}$'),
  phone_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null unique check (char_length(credential_id) between 16 and 1024),
  public_key text not null,
  sign_count bigint not null default 0 check (sign_count >= 0),
  transports text[] not null default '{}',
  device_type text,
  backed_up boolean not null default false,
  nickname text check (nickname is null or char_length(nickname) <= 40),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index passkey_credentials_user_idx on public.passkey_credentials(user_id);

create table public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  kind text not null check (kind in ('register', 'login', 'add_passkey', 'reauth')),
  user_id uuid references public.profiles(id) on delete cascade,
  session_id uuid,
  phone_number text,
  display_name text,
  rp_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index webauthn_challenges_expires_idx on public.webauthn_challenges(expires_at);
create index webauthn_challenges_user_idx on public.webauthn_challenges(user_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reauth_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index sessions_user_idx on public.sessions(user_id);
alter table public.webauthn_challenges
  add constraint webauthn_challenges_session_fk foreign key (session_id) references public.sessions(id) on delete cascade;
create index webauthn_challenges_session_idx on public.webauthn_challenges(session_id);

-- ------------------------------------------------------------------ payment destinations

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  upi_id text not null check (upi_id ~ '^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,64}$'),
  display_name text check (display_name is null or char_length(display_name) <= 60),
  -- Format checks and the owner's confirmation make a destination 'validated'. Nothing in this
  -- version can mark one 'verified': that needs a payment provider to confirm the account holder.
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'validated', 'verified', 'disabled')),
  source text not null default 'typed' check (source in ('typed', 'qr')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_methods_user_idx on public.payment_methods(user_id);
create unique index payment_methods_one_live_per_upi on public.payment_methods(user_id, upi_id)
  where verification_status <> 'disabled';
create unique index payment_methods_one_default on public.payment_methods(user_id)
  where is_default and verification_status <> 'disabled';

-- ------------------------------------------------------------------ groups

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index groups_created_by_idx on public.groups(created_by);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (group_id, user_id)
);
create index group_members_user_idx on public.group_members(user_id);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index group_invites_group_idx on public.group_invites(group_id);
create index group_invites_created_by_idx on public.group_invites(created_by);

-- ------------------------------------------------------------------ expenses

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_id uuid not null references public.profiles(id),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000000),
  description text not null check (char_length(description) between 1 and 120),
  category text check (category is null or char_length(category) <= 32),
  split_method text not null check (split_method in ('equal', 'exact', 'percent')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id)
);
create index expenses_group_idx on public.expenses(group_id, created_at desc);
create index expenses_payer_idx on public.expenses(payer_id);
create index expenses_created_by_idx on public.expenses(created_by);
create index expenses_deleted_by_idx on public.expenses(deleted_by);

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  share_paise bigint not null check (share_paise >= 0),
  unique (expense_id, user_id)
);
create index expense_splits_user_idx on public.expense_splits(user_id);

-- ------------------------------------------------------------------ settlements

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  receiver_id uuid not null references public.profiles(id),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000000),
  payment_method_id uuid references public.payment_methods(id),
  status text not null default 'pending'
    check (status in ('pending', 'initiated', 'awaiting_confirmation', 'confirmed', 'failed', 'disputed', 'cancelled')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id),
  unique (sender_id, idempotency_key)
);
create index settlements_group_idx on public.settlements(group_id, created_at desc);
create index settlements_receiver_idx on public.settlements(receiver_id);
create index settlements_payment_method_idx on public.settlements(payment_method_id);

create table public.settlement_attempts (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 80),
  payment_method_id uuid references public.payment_methods(id),
  upi_id text not null,
  initiated_at timestamptz not null default now(),
  result_status text not null default 'initiated' check (result_status in ('initiated', 'sent', 'failed', 'cancelled')),
  result_at timestamptz,
  transaction_reference text check (transaction_reference is null or char_length(transaction_reference) <= 64)
);
create index settlement_attempts_settlement_idx on public.settlement_attempts(settlement_id);
create index settlement_attempts_payment_method_idx on public.settlement_attempts(payment_method_id);

create table public.settlement_events (
  id bigint generated always as identity primary key,
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  from_status text,
  to_status text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index settlement_events_settlement_idx on public.settlement_events(settlement_id, id);
create index settlement_events_actor_idx on public.settlement_events(actor_id);

-- ------------------------------------------------------------------ audit and limits

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_log_user_idx on public.audit_log(user_id, created_at desc);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- History can be added to, never rewritten.
create function public.forbid_change() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'append-only table: % cannot be %', tg_table_name, lower(tg_op);
end $$;
create trigger settlement_events_append_only before update or delete on public.settlement_events
  for each row execute function public.forbid_change();
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function public.forbid_change();

-- ------------------------------------------------------------------ lock everything down

alter table public.profiles enable row level security;
alter table public.passkey_credentials enable row level security;
alter table public.webauthn_challenges enable row level security;
alter table public.sessions enable row level security;
alter table public.payment_methods enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_attempts enable row level security;
alter table public.settlement_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on function public.forbid_change() from public, anon, authenticated;
