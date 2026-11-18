-- Pay requests: when you split something with a friend whose phone number belongs to a Settle
-- account, they hear about it in their own Settle ("Ayush: Dinner · you owe ₹800 · Pay"), and on
-- their phone when they've turned notifications on. Nothing to do for the person splitting: the
-- server raises them after each sync of the splitter's data.
--
-- Same lock-down as the rest: RLS on, no policies, only the service role (the settle-api Edge
-- Function) reads or writes. Money is integer paise.

create table public.pay_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  -- The split on the sender's account (user_expenses.id) and who it is in their people.
  expense_id text not null check (char_length(expense_id) between 1 and 64),
  friend_id text not null check (char_length(friend_id) between 1 and 64),
  title text not null check (char_length(title) <= 200),
  amount bigint not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  -- open → paid (the payer says so) | dismissed (the payer hides it) | settled (the sender ticked
  -- it off) | withdrawn (the split was deleted, or they're no longer in it)
  status text not null default 'open' check (status in ('open', 'paid', 'dismissed', 'settled', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- When the phone notification went out (null: not sent, e.g. no subscription).
  pushed_at timestamptz,
  unique (from_user, expense_id, to_user),
  check (from_user <> to_user)
);
create index pay_requests_to_open_idx on public.pay_requests(to_user, created_at desc) where status = 'open';
create index pay_requests_from_idx on public.pay_requests(from_user, updated_at desc);
alter table public.pay_requests enable row level security;

-- Where to send a phone notification (Web Push), one row per browser that said yes.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

-- A phone number as people type it ("98765 43210", "+91-98765-43210", "098765…") → "+919876543210",
-- or null when it isn't an Indian mobile number.
create function public.indian_mobile(p_raw text) returns text
language sql immutable set search_path = '' as $$
  select case
    when d ~ '^[6-9][0-9]{9}$' then '+91' || d
    when d ~ '^91[6-9][0-9]{9}$' then '+' || d
    when d ~ '^0[6-9][0-9]{9}$' then '+91' || substr(d, 2)
    else null
  end
  from (select regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g') as d) x
$$;

-- Raises (and tidies) pay requests for one person's splits after their data synced. Only splits
-- they paid for, made in the last 14 days (so a first sync doesn't dig up old history), for people
-- who still owe. A friend's request follows the split: a new amount or title updates an open one;
-- a deleted split or a paid-back share closes it. At most 60 new requests a day per sender.
-- Returns the requests created just now (to notify).
create function public.raise_pay_requests(p_user uuid)
returns table (id uuid, to_user uuid, title text, amount bigint, currency text)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  v_since bigint := (extract(epoch from now()) * 1000)::bigint - 14 * 86400000;
  v_room integer;
begin
  -- Closed: the split was deleted, or the person is out of it or has paid it back.
  update public.pay_requests r set status = case when e.id is not null and not e.deleted and e.paid_back ? r2.friend_id then 'settled' else 'withdrawn' end,
    updated_at = now()
  from public.pay_requests r2
  left join public.user_expenses e on e.user_id = r2.from_user and e.id = r2.expense_id
  left join public.user_expense_shares s on s.user_id = r2.from_user and s.expense_id = r2.expense_id and s.friend_id = r2.friend_id
  where r.id = r2.id and r2.from_user = p_user and r2.status in ('open', 'paid')
    and (e.id is null or e.deleted or s.friend_id is null or s.share <= 0 or e.paid_back ? r2.friend_id);

  -- Still open: keep the amount and title in step with the split.
  update public.pay_requests r set amount = s.share, title = e.title, currency = e.currency, updated_at = now()
  from public.user_expenses e
  join public.user_expense_shares s on s.user_id = e.user_id and s.expense_id = e.id
  where r.from_user = p_user and r.status = 'open' and e.user_id = p_user and e.id = r.expense_id and s.friend_id = r.friend_id
    and s.share > 0 and (r.amount <> s.share or r.title <> e.title or r.currency <> e.currency);

  select greatest(0, 60 - count(*))::integer into v_room
  from public.pay_requests r where r.from_user = p_user and r.created_at > now() - interval '1 day';

  return query
  insert into public.pay_requests as r (from_user, to_user, expense_id, friend_id, title, amount, currency)
  select distinct on (e.id, p.id) p_user, p.id, e.id, f.id, e.title, s.share, e.currency
  from public.user_expenses e
  join public.user_expense_shares s on s.user_id = e.user_id and s.expense_id = e.id
  join public.user_friends f on f.user_id = e.user_id and f.id = s.friend_id
  join public.profiles p on p.phone_number = public.indian_mobile(f.phone)
  where e.user_id = p_user and not e.deleted and e.payer_id = 'me' and e.created_at >= v_since
    and s.friend_id <> 'me' and s.share > 0 and not f.deleted and not (e.paid_back ? s.friend_id)
    and p.id <> p_user
  order by e.id, p.id, s.share desc
  limit v_room
  on conflict (from_user, expense_id, to_user) do nothing
  returning r.id, r.to_user, r.title, r.amount, r.currency;
end $$;

revoke all on function public.raise_pay_requests(uuid) from public, anon, authenticated;
revoke all on function public.indian_mobile(text) from public, anon, authenticated;
