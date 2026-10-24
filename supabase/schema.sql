-- Tack Room — Supabase schema
-- Run this once in the Supabase SQL editor (Database → SQL Editor → New query).
-- Everything here is safe to re-run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------
create or replace function public.set_audit_columns()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- Staff profiles: one row per login. Filled automatically on sign-up.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'instructor' check (role in ('owner','instructor')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  rider_level text check (rider_level in ('beginner','advanced_beginner','intermediate','advanced')),
  guardian_name text,
  emergency_contact text,
  notes text,
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
);

create table if not exists public.horses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  breed text,
  age integer,
  height_hands numeric(4,1),
  temperament text,
  lease_status text not null default 'available' check (lease_status in ('available','leased','lesson_only','retired')),
  notes text,
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
);

create table if not exists public.offerings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'lesson_package'
    check (category in ('lesson_package','private_lesson','group_lesson','workshop','clinic','camp','other')),
  level text check (level in ('beginner','advanced_beginner','intermediate','advanced','all')),
  lessons_included integer,
  duration_minutes integer,
  price numeric(10,2),
  validity_days integer,
  description text,
  active boolean not null default true,
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
);

-- ---------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------
create table if not exists public.waivers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references public.clients(id) on delete set null,
  waiver_type text not null default 'liability'
    check (waiver_type in ('liability','photo_release','medical','minor_consent','other')),
  status text not null default 'draft' check (status in ('draft','sent','signed','expired')),
  signed_on date,
  expires_on date,
  file_path text,
  notes text,
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contract_type text not null default 'lesson_package'
    check (contract_type in ('lesson_package','horse_lease')),
  client_id uuid references public.clients(id) on delete set null,
  offering_id uuid references public.offerings(id) on delete set null,
  horse_id uuid references public.horses(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','sent','signed','active','expired','cancelled')),
  start_date date,
  end_date date,
  amount numeric(10,2),
  billing text check (billing in ('one_time','monthly','per_lesson')),
  file_path text,
  terms text,
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
);

-- ---------------------------------------------------------------
-- Content library
-- ---------------------------------------------------------------
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'email' check (channel in ('email','text','youtube')),
  purpose text,
  subject text,
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'homework' check (kind in ('homework','worksheet','reading','quiz')),
  offering_id uuid references public.offerings(id) on delete set null,
  level text check (level in ('beginner','advanced_beginner','intermediate','advanced','all')),
  body text not null default '',
  file_path text,
  estimated_minutes integer,
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
);

-- ---------------------------------------------------------------
-- Audit triggers + row-level security (any signed-in staff member has full access)
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients','horses','offerings','waivers','contracts','scripts','homework'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s before insert or update on public.%1$s for each row execute function public.set_audit_columns()', t);
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists "staff full access" on public.%1$s', t);
    execute format('create policy "staff full access" on public.%1$s for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Live updates between staff: publish every table so the app can subscribe.
do $$
declare t text;
begin
  foreach t in array array['clients','horses','offerings','waivers','contracts','scripts','homework'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "staff read profiles" on public.profiles;
create policy "staff read profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- ---------------------------------------------------------------
-- Storage: private bucket for signed PDFs and worksheet files
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400,
        array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff read documents" on storage.objects;
create policy "staff read documents" on storage.objects
  for select to authenticated using (bucket_id = 'documents');
drop policy if exists "staff upload documents" on storage.objects;
create policy "staff upload documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');
drop policy if exists "staff update documents" on storage.objects;
create policy "staff update documents" on storage.objects
  for update to authenticated using (bucket_id = 'documents');
drop policy if exists "staff delete documents" on storage.objects;
create policy "staff delete documents" on storage.objects
  for delete to authenticated using (bucket_id = 'documents');
