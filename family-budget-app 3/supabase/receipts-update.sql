-- ---------------------------------------------------------------------------
-- Belege (Fotos/PDFs) pro Ausgabe + Duplikat-Erkennung
-- ---------------------------------------------------------------------------

alter table expenses add column if not exists receipt_path text;
alter table expenses add column if not exists receipt_hash text;
create index if not exists expenses_receipt_hash_idx on expenses (household_id, receipt_hash);

-- Ausgaben nachträglich bearbeiten (UPDATE-Policy)
drop policy if exists "update expenses" on expenses;
create policy "update expenses" on expenses
  for update using (is_household_member(household_id));

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "select own household receipts" on storage.objects;
create policy "select own household receipts" on storage.objects for select
using (bucket_id = 'receipts' and is_household_member((storage.foldername(name))[1]::uuid));

drop policy if exists "insert own household receipts" on storage.objects;
create policy "insert own household receipts" on storage.objects for insert
with check (bucket_id = 'receipts' and is_household_member((storage.foldername(name))[1]::uuid));

drop policy if exists "delete own household receipts" on storage.objects;
create policy "delete own household receipts" on storage.objects for delete
using (bucket_id = 'receipts' and is_household_member((storage.foldername(name))[1]::uuid));
