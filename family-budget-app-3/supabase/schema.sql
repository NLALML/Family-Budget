-- Family-Budget: Supabase Schema
-- Im Supabase Dashboard unter "SQL Editor" komplett einfügen und ausführen.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Generischer Key-Value-Speicher pro Haushalt (year-budget:2026, fixed-costs, ...)
create table if not exists app_data (
  household_id uuid not null references households(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, key)
);

-- Eine Zeile pro erfasster Ausgabe (statt eines einzelnen JSON-Arrays), damit
-- gleichzeitige Erfassungen durch mehrere Familienmitglieder sich nie
-- gegenseitig überschreiben können.
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id text not null,
  position text,
  date date not null,
  ort text,
  einkaeufer text,
  betrag numeric not null default 0,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists expenses_household_date_idx on expenses (household_id, date desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table household_members enable row level security;
alter table app_data enable row level security;
alter table expenses enable row level security;

create or replace function is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create policy "select own household" on households
  for select using (is_household_member(id));
create policy "update own household" on households
  for update using (is_household_member(id));

create policy "select members of own household" on household_members
  for select using (is_household_member(household_id));

create policy "select app_data" on app_data
  for select using (is_household_member(household_id));
create policy "insert app_data" on app_data
  for insert with check (is_household_member(household_id));
create policy "update app_data" on app_data
  for update using (is_household_member(household_id));
create policy "delete app_data" on app_data
  for delete using (is_household_member(household_id));

create policy "select expenses" on expenses
  for select using (is_household_member(household_id));
create policy "insert expenses" on expenses
  for insert with check (is_household_member(household_id));
create policy "delete expenses" on expenses
  for delete using (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Funktionen zum Erstellen / Beitreten eines Haushalts
-- (SECURITY DEFINER, damit ein Nutzer ohne bestehende Mitgliedschaft trotzdem
--  einen Haushalt per Einladungscode finden und beitreten kann, ohne dass
--  die households-Tabelle komplett öffentlich lesbar sein muss.)
-- ---------------------------------------------------------------------------

create or replace function create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  code text;
begin
  code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  insert into households (name, invite_code) values (household_name, code) returning id into hid;
  insert into household_members (household_id, user_id, email) values (hid, auth.uid(), auth.email());
  return hid;
end;
$$;

create or replace function join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  select id into hid from households where invite_code = code;
  if hid is null then
    raise exception 'Ungültiger Einladungscode';
  end if;
  insert into household_members (household_id, user_id, email)
  values (hid, auth.uid(), auth.email())
  on conflict do nothing;
  return hid;
end;
$$;

-- Erzeugt für den eigenen Haushalt einen neuen Einladungscode (z. B. falls der
-- alte Code versehentlich weitergegeben wurde) und gibt ihn zurück.
create or replace function regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  new_code text;
begin
  select household_id into hid from household_members where user_id = auth.uid() limit 1;
  if hid is null then
    raise exception 'Kein Haushalt gefunden';
  end if;
  new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  update households set invite_code = new_code where id = hid;
  return new_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime aktivieren, damit alle Haushaltsmitglieder Live-Updates bekommen
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table app_data;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table households;
