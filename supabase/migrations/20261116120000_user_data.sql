-- Everything a person keeps in Settle, on their account. The phone keeps a working copy (so the
-- app works offline) and syncs both ways through the `settle-api` Edge Function:
--   * people, groups (members, recorded payments) and expenses (one row per person's share) as
--     real tables;
--   * every other ledger (tally, committee, house help, settings…) as one JSON row per store key.
-- Rows are never hard-deleted by a sync: a deletion is a row with `deleted = true`, so every phone
-- hears about it. Times are the app's own epoch milliseconds. `rev` orders changes for pulling.
-- Same lock-down as the rest: RLS on, no policies, only the service role.

create sequence public.user_data_rev;

create function public.bump_user_data_rev() returns trigger language plpgsql set search_path = '' as $$
begin
  new.rev := nextval('public.user_data_rev');
  return new;
end $$;

create table public.user_friends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) <= 80),
  color integer not null default 0,
  upi_id text check (upi_id is null or char_length(upi_id) <= 320),
  phone text check (phone is null or char_length(phone) <= 32),
  created_at bigint not null,
  last_used_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  rev bigint not null default 0,
  primary key (user_id, id)
);
create index user_friends_rev_idx on public.user_friends(user_id, rev);

create table public.user_groups (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) <= 120),
  emoji text not null default '' check (char_length(emoji) <= 32),
  kind text not null check (char_length(kind) <= 16),
  currency text not null check (char_length(currency) between 3 and 3),
  archived boolean not null default false,
  travel_currency text check (travel_currency is null or char_length(travel_currency) = 3),
  round_size bigint,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  rev bigint not null default 0,
  primary key (user_id, id)
);
create index user_groups_rev_idx on public.user_groups(user_id, rev);

create table public.user_group_members (
  user_id uuid not null,
  group_id text not null,
  friend_id text not null check (char_length(friend_id) between 1 and 64),
  position integer not null,
  primary key (user_id, group_id, friend_id),
  foreign key (user_id, group_id) references public.user_groups(user_id, id) on delete cascade
);

create table public.user_group_settlements (
  user_id uuid not null,
  group_id text not null,
  id text not null check (char_length(id) between 1 and 64),
  from_id text not null,
  to_id text not null,
  amount bigint not null,
  date text not null check (char_length(date) <= 10),
  method text not null check (char_length(method) <= 16),
  created_at bigint not null,
  primary key (user_id, group_id, id),
  foreign key (user_id, group_id) references public.user_groups(user_id, id) on delete cascade
);

create table public.user_expenses (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  kind text not null check (char_length(kind) <= 16),
  title text not null check (char_length(title) <= 200),
  category text not null check (char_length(category) <= 32),
  currency text not null check (char_length(currency) = 3),
  total bigint not null,
  date text not null check (char_length(date) <= 10),
  payer_id text not null check (char_length(payer_id) between 1 and 64),
  mode text not null check (char_length(mode) <= 16),
  group_id text check (group_id is null or char_length(group_id) <= 64),
  note text check (note is null or char_length(note) <= 2000),
  rounded_to_whole boolean not null default false,
  source text not null check (char_length(source) <= 16),
  recurring_id text check (recurring_id is null or char_length(recurring_id) <= 64),
  -- The parts that only the app reads: the split inputs, an itemized bill, who paid back, foreign currency.
  participants jsonb not null default '[]'::jsonb,
  bill jsonb,
  paid_back jsonb not null default '{}'::jsonb,
  part_paid jsonb,
  fx jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  rev bigint not null default 0,
  primary key (user_id, id),
  check (pg_column_size(bill) is null or pg_column_size(bill) < 1000000)
);
create index user_expenses_rev_idx on public.user_expenses(user_id, rev);
create index user_expenses_group_idx on public.user_expenses(user_id, group_id) where not deleted;

create table public.user_expense_shares (
  user_id uuid not null,
  expense_id text not null,
  friend_id text not null check (char_length(friend_id) between 1 and 64),
  share bigint not null,
  primary key (user_id, expense_id, friend_id),
  foreign key (user_id, expense_id) references public.user_expenses(user_id, id) on delete cascade
);

-- Every other store, exactly as the phone keeps it (`{ v, data }`), by its storage key.
create table public.user_stores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null check (key ~ '^settle\.[A-Za-z0-9._-]+$' and char_length(key) <= 80),
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  rev bigint not null default 0,
  primary key (user_id, key),
  check (pg_column_size(data) < 2000000)
);
create index user_stores_rev_idx on public.user_stores(user_id, rev);

create trigger user_friends_rev before insert or update on public.user_friends for each row execute function public.bump_user_data_rev();
create trigger user_groups_rev before insert or update on public.user_groups for each row execute function public.bump_user_data_rev();
create trigger user_expenses_rev before insert or update on public.user_expenses for each row execute function public.bump_user_data_rev();
create trigger user_stores_rev before insert or update on public.user_stores for each row execute function public.bump_user_data_rev();

alter table public.user_friends enable row level security;
alter table public.user_groups enable row level security;
alter table public.user_group_members enable row level security;
alter table public.user_group_settlements enable row level security;
alter table public.user_expenses enable row level security;
alter table public.user_expense_shares enable row level security;
alter table public.user_stores enable row level security;
revoke all on public.user_friends, public.user_groups, public.user_group_members, public.user_group_settlements,
  public.user_expenses, public.user_expense_shares, public.user_stores from anon, authenticated;
revoke all on sequence public.user_data_rev from anon, authenticated;

-- ------------------------------------------------------------------ push

-- Saves what one phone changed. For each row the newer change wins (by the app's updatedAt); a
-- group's members and payments, and an expense's shares, are replaced together with their row.
-- Returns how many rows were written.
create function public.sync_push(p_user uuid, p_payload jsonb) returns integer
language plpgsql set search_path = '' as $$
declare
  v_written integer := 0;
  v_n integer;
  v_groups text[];
  v_expenses text[];
begin
  perform pg_advisory_xact_lock(hashtextextended('sync:' || p_user::text, 0));

  insert into public.user_friends as t (user_id, id, name, color, upi_id, phone, created_at, last_used_at, updated_at, deleted)
  select distinct on (x ->> 'id') p_user, x ->> 'id', coalesce(x ->> 'name', ''), coalesce((x ->> 'color')::integer, 0),
    x ->> 'upiId', x ->> 'phone', coalesce((x ->> 'createdAt')::bigint, 0), coalesce((x ->> 'lastUsedAt')::bigint, 0),
    (x ->> 'updatedAt')::bigint, coalesce((x ->> 'deleted')::boolean, false)
  from jsonb_array_elements(coalesce(p_payload -> 'friends', '[]'::jsonb)) x
  order by x ->> 'id', (x ->> 'updatedAt')::bigint desc
  on conflict (user_id, id) do update set
    name = excluded.name, color = excluded.color, upi_id = excluded.upi_id, phone = excluded.phone,
    created_at = excluded.created_at, last_used_at = excluded.last_used_at, updated_at = excluded.updated_at, deleted = excluded.deleted
  where excluded.updated_at >= t.updated_at;
  get diagnostics v_n = row_count;
  v_written := v_written + v_n;

  with w as (
    insert into public.user_groups as t (user_id, id, name, emoji, kind, currency, archived, travel_currency, round_size, created_at, updated_at, deleted)
    select distinct on (x ->> 'id') p_user, x ->> 'id', coalesce(x ->> 'name', ''), coalesce(x ->> 'emoji', ''), coalesce(x ->> 'kind', 'other'),
      coalesce(x ->> 'currency', 'INR'), coalesce((x ->> 'archived')::boolean, false), x ->> 'travelCurrency', (x ->> 'roundSize')::bigint,
      coalesce((x ->> 'createdAt')::bigint, 0), (x ->> 'updatedAt')::bigint, coalesce((x ->> 'deleted')::boolean, false)
    from jsonb_array_elements(coalesce(p_payload -> 'groups', '[]'::jsonb)) x
    order by x ->> 'id', (x ->> 'updatedAt')::bigint desc
    on conflict (user_id, id) do update set
      name = excluded.name, emoji = excluded.emoji, kind = excluded.kind, currency = excluded.currency, archived = excluded.archived,
      travel_currency = excluded.travel_currency, round_size = excluded.round_size, created_at = excluded.created_at,
      updated_at = excluded.updated_at, deleted = excluded.deleted
    where excluded.updated_at >= t.updated_at
    returning t.id
  )
  select coalesce(array_agg(id), '{}') into v_groups from w;
  v_written := v_written + cardinality(v_groups);
  delete from public.user_group_members where user_id = p_user and group_id = any(v_groups);
  delete from public.user_group_settlements where user_id = p_user and group_id = any(v_groups);
  insert into public.user_group_members (user_id, group_id, friend_id, position)
  select distinct on (g ->> 'id', m.value) p_user, g ->> 'id', m.value, (m.ord - 1)::integer
  from jsonb_array_elements(coalesce(p_payload -> 'groups', '[]'::jsonb)) g,
    jsonb_array_elements_text(coalesce(g -> 'memberIds', '[]'::jsonb)) with ordinality m(value, ord)
  where g ->> 'id' = any(v_groups) and not coalesce((g ->> 'deleted')::boolean, false)
  order by g ->> 'id', m.value, (g ->> 'updatedAt')::bigint desc;
  insert into public.user_group_settlements (user_id, group_id, id, from_id, to_id, amount, date, method, created_at)
  select distinct on (g ->> 'id', s ->> 'id') p_user, g ->> 'id', s ->> 'id', s ->> 'fromId', s ->> 'toId', (s ->> 'amount')::bigint,
    coalesce(s ->> 'date', ''), coalesce(s ->> 'method', 'other'), coalesce((s ->> 'createdAt')::bigint, 0)
  from jsonb_array_elements(coalesce(p_payload -> 'groups', '[]'::jsonb)) g,
    jsonb_array_elements(coalesce(g -> 'settlements', '[]'::jsonb)) s
  where g ->> 'id' = any(v_groups) and not coalesce((g ->> 'deleted')::boolean, false)
  order by g ->> 'id', s ->> 'id', (g ->> 'updatedAt')::bigint desc;

  with w as (
    insert into public.user_expenses as t (user_id, id, kind, title, category, currency, total, date, payer_id, mode, group_id, note,
      rounded_to_whole, source, recurring_id, participants, bill, paid_back, part_paid, fx, created_at, updated_at, deleted)
    select distinct on (x ->> 'id') p_user, x ->> 'id', coalesce(x ->> 'kind', 'split'), coalesce(x ->> 'title', ''), coalesce(x ->> 'category', 'other'),
      coalesce(x ->> 'currency', 'INR'), coalesce((x ->> 'total')::bigint, 0), coalesce(x ->> 'date', ''), coalesce(x ->> 'payerId', 'me'),
      coalesce(x ->> 'mode', 'equal'), x ->> 'groupId', x ->> 'note', coalesce((x ->> 'roundedToWhole')::boolean, false),
      coalesce(x ->> 'source', 'manual'), x ->> 'recurringId', coalesce(x -> 'participants', '[]'::jsonb), nullif(x -> 'bill', 'null'::jsonb),
      coalesce(nullif(x -> 'paidBack', 'null'::jsonb), '{}'::jsonb), nullif(x -> 'partPaid', 'null'::jsonb), nullif(x -> 'fx', 'null'::jsonb),
      coalesce((x ->> 'createdAt')::bigint, 0), (x ->> 'updatedAt')::bigint, coalesce((x ->> 'deleted')::boolean, false)
    from jsonb_array_elements(coalesce(p_payload -> 'expenses', '[]'::jsonb)) x
    order by x ->> 'id', (x ->> 'updatedAt')::bigint desc
    on conflict (user_id, id) do update set
      kind = excluded.kind, title = excluded.title, category = excluded.category, currency = excluded.currency, total = excluded.total,
      date = excluded.date, payer_id = excluded.payer_id, mode = excluded.mode, group_id = excluded.group_id, note = excluded.note,
      rounded_to_whole = excluded.rounded_to_whole, source = excluded.source, recurring_id = excluded.recurring_id,
      participants = excluded.participants, bill = excluded.bill, paid_back = excluded.paid_back, part_paid = excluded.part_paid,
      fx = excluded.fx, created_at = excluded.created_at, updated_at = excluded.updated_at, deleted = excluded.deleted
    where excluded.updated_at >= t.updated_at
    returning t.id
  )
  select coalesce(array_agg(id), '{}') into v_expenses from w;
  v_written := v_written + cardinality(v_expenses);
  delete from public.user_expense_shares where user_id = p_user and expense_id = any(v_expenses);
  insert into public.user_expense_shares (user_id, expense_id, friend_id, share)
  select distinct on (x ->> 'id', s.key) p_user, x ->> 'id', s.key, (s.value #>> '{}')::bigint
  from jsonb_array_elements(coalesce(p_payload -> 'expenses', '[]'::jsonb)) x,
    jsonb_each(coalesce(x -> 'shares', '{}'::jsonb)) s
  where x ->> 'id' = any(v_expenses) and not coalesce((x ->> 'deleted')::boolean, false)
  order by x ->> 'id', s.key, (x ->> 'updatedAt')::bigint desc;

  insert into public.user_stores as t (user_id, key, data, updated_at, deleted)
  select distinct on (x ->> 'key') p_user, x ->> 'key', coalesce(x -> 'data', 'null'::jsonb), (x ->> 'updatedAt')::bigint, coalesce((x ->> 'deleted')::boolean, false)
  from jsonb_array_elements(coalesce(p_payload -> 'stores', '[]'::jsonb)) x
  order by x ->> 'key', (x ->> 'updatedAt')::bigint desc
  on conflict (user_id, key) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted
  where excluded.updated_at >= t.updated_at;
  get diagnostics v_n = row_count;
  v_written := v_written + v_n;

  return v_written;
end $$;

-- ------------------------------------------------------------------ pull

-- Everything that changed for this person after `p_since`, at most `p_cap` rows of each kind.
-- `cursor` is where the next pull starts; `more` says there is more to fetch now.
create function public.sync_pull(p_user uuid, p_since bigint, p_cap integer) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_friends jsonb;
  v_groups jsonb;
  v_expenses jsonb;
  v_stores jsonb;
  v_counts integer[];
  v_lasts bigint[];
  v_cursor bigint;
  v_more boolean;
begin
  -- Never in the middle of this person's own push, so no change is skipped.
  perform pg_advisory_xact_lock(hashtextextended('sync:' || p_user::text, 0));

  select coalesce(jsonb_agg(r order by (r ->> 'rev')::bigint), '[]'::jsonb) into v_friends from (
    select jsonb_build_object('id', f.id, 'name', f.name, 'color', f.color, 'upiId', f.upi_id, 'phone', f.phone,
      'createdAt', f.created_at, 'lastUsedAt', f.last_used_at, 'updatedAt', f.updated_at, 'deleted', f.deleted, 'rev', f.rev) r
    from public.user_friends f where f.user_id = p_user and f.rev > p_since order by f.rev limit p_cap
  ) q;

  select coalesce(jsonb_agg(r order by (r ->> 'rev')::bigint), '[]'::jsonb) into v_groups from (
    select jsonb_build_object('id', g.id, 'name', g.name, 'emoji', g.emoji, 'kind', g.kind, 'currency', g.currency,
      'archived', g.archived, 'travelCurrency', g.travel_currency, 'roundSize', g.round_size, 'createdAt', g.created_at,
      'updatedAt', g.updated_at, 'deleted', g.deleted, 'rev', g.rev,
      'memberIds', coalesce((select jsonb_agg(m.friend_id order by m.position) from public.user_group_members m
        where m.user_id = p_user and m.group_id = g.id), '[]'::jsonb),
      'settlements', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'fromId', s.from_id, 'toId', s.to_id, 'amount', s.amount,
        'date', s.date, 'method', s.method, 'createdAt', s.created_at) order by s.created_at, s.id) from public.user_group_settlements s
        where s.user_id = p_user and s.group_id = g.id), '[]'::jsonb)) r
    from public.user_groups g where g.user_id = p_user and g.rev > p_since order by g.rev limit p_cap
  ) q;

  select coalesce(jsonb_agg(r order by (r ->> 'rev')::bigint), '[]'::jsonb) into v_expenses from (
    select jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'category', e.category, 'currency', e.currency,
      'total', e.total, 'date', e.date, 'payerId', e.payer_id, 'mode', e.mode, 'groupId', e.group_id, 'note', e.note,
      'roundedToWhole', e.rounded_to_whole, 'source', e.source, 'recurringId', e.recurring_id, 'participants', e.participants,
      'bill', e.bill, 'paidBack', e.paid_back, 'partPaid', e.part_paid, 'fx', e.fx, 'createdAt', e.created_at,
      'updatedAt', e.updated_at, 'deleted', e.deleted, 'rev', e.rev,
      'shares', coalesce((select jsonb_object_agg(s.friend_id, s.share) from public.user_expense_shares s
        where s.user_id = p_user and s.expense_id = e.id), '{}'::jsonb)) r
    from public.user_expenses e where e.user_id = p_user and e.rev > p_since order by e.rev limit p_cap
  ) q;

  select coalesce(jsonb_agg(r order by (r ->> 'rev')::bigint), '[]'::jsonb) into v_stores from (
    select jsonb_build_object('key', s.key, 'data', s.data, 'updatedAt', s.updated_at, 'deleted', s.deleted, 'rev', s.rev) r
    from public.user_stores s where s.user_id = p_user and s.rev > p_since order by s.rev limit p_cap
  ) q;

  v_counts := array[jsonb_array_length(v_friends), jsonb_array_length(v_groups), jsonb_array_length(v_expenses), jsonb_array_length(v_stores)];
  v_lasts := array[
    coalesce((v_friends -> -1 ->> 'rev')::bigint, 0), coalesce((v_groups -> -1 ->> 'rev')::bigint, 0),
    coalesce((v_expenses -> -1 ->> 'rev')::bigint, 0), coalesce((v_stores -> -1 ->> 'rev')::bigint, 0)];
  v_more := p_cap = any(v_counts);
  if v_more then
    -- Resume from the earliest kind that was cut short; rows past it come again, harmlessly.
    select min(v_lasts[i]) into v_cursor from generate_subscripts(v_counts, 1) i where v_counts[i] = p_cap;
  else
    v_cursor := greatest(p_since, v_lasts[1], v_lasts[2], v_lasts[3], v_lasts[4]);
  end if;

  return jsonb_build_object('friends', v_friends, 'groups', v_groups, 'expenses', v_expenses, 'stores', v_stores,
    'cursor', v_cursor, 'more', v_more);
end $$;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('sync_push', 'sync_pull', 'bump_user_data_rev')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
