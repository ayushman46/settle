-- Postgres caps regex repetition at 255, so `{2,256}` failed at runtime. Same rule as the app's
-- (shared/cloud.ts): a 2–256 character handle, then @bank.
alter table public.payment_methods drop constraint payment_methods_upi_id_check;
alter table public.payment_methods add constraint payment_methods_upi_id_check check (
  upi_id ~ '^[a-z0-9._-]+@[a-z][a-z0-9.-]{1,64}$'
  and char_length(split_part(upi_id, '@', 1)) between 2 and 256
);
