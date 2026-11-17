-- Live groups' relay (server/sync.ts): one opaque, end-to-end encrypted copy per group room.
-- The database can't read it; it only knows the room name, the hash of the write token, and when
-- the copy was last written. Reached only through the settle-api Edge Function (service role).
create table if not exists public.sync_rooms (
  room text primary key check (room ~ '^[A-Za-z0-9_-]{22,64}$'),
  w text not null check (char_length(w) between 16 and 128),
  d text not null check (char_length(d) between 16 and 420000),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.sync_rooms enable row level security;
revoke all on public.sync_rooms from anon, authenticated;

-- Writes a room's copy unless it already belongs to another write token. True when written.
create or replace function public.relay_put(p_room text, p_w text, p_d text, p_ttl_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_written integer;
begin
  insert into public.sync_rooms as r (room, w, d, updated_at, expires_at)
  values (p_room, p_w, p_d, now(), now() + make_interval(secs => least(greatest(p_ttl_seconds, 60), 400 * 86400)))
  on conflict (room) do update
    set d = excluded.d, updated_at = excluded.updated_at, expires_at = excluded.expires_at, w = excluded.w
    where r.w = excluded.w or r.expires_at < now();
  get diagnostics v_written = row_count;
  return v_written = 1;
end;
$$;
revoke all on function public.relay_put(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.relay_put(text, text, text, integer) to service_role;
