-- One older store key uses a hyphen (settle-proof-refs).
alter table public.user_stores drop constraint user_stores_key_check;
alter table public.user_stores add constraint user_stores_key_check check (key ~ '^settle[.-][A-Za-z0-9._-]+$' and char_length(key) <= 80);
