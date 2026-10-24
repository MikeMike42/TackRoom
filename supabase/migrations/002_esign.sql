-- E-signature for waivers. Run after schema.sql (and 001_levels.sql).
-- Safe to re-run.

-- ---------------------------------------------------------------
-- Waiver templates: the text riders agree to, written once per type.
-- ---------------------------------------------------------------
create table if not exists public.waiver_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  waiver_type text not null default 'liability'
    check (waiver_type in ('liability','photo_release','medical','minor_consent','other')),
  body text not null default '',
  requires_guardian_for_minors boolean not null default true,
  valid_days integer,
  active boolean not null default true,
  created_at timestamptz, created_by uuid, updated_at timestamptz, updated_by uuid
);

drop trigger if exists audit_waiver_templates on public.waiver_templates;
create trigger audit_waiver_templates before insert or update on public.waiver_templates
  for each row execute function public.set_audit_columns();
alter table public.waiver_templates enable row level security;
drop policy if exists "staff full access" on public.waiver_templates;
create policy "staff full access" on public.waiver_templates for all to authenticated using (true) with check (true);
do $$ begin
  execute 'alter publication supabase_realtime add table public.waiver_templates';
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------
-- Signing fields on waivers
-- ---------------------------------------------------------------
alter table public.waivers
  add column if not exists template_id uuid references public.waiver_templates(id) on delete set null,
  add column if not exists signer_email text,
  add column if not exists body_snapshot text,          -- exact text the signer agreed to
  add column if not exists sign_token text unique,       -- random, single use
  add column if not exists token_expires_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signer_name text,
  add column if not exists signer_is_minor boolean,
  add column if not exists guardian_name text,
  add column if not exists signature_path text,          -- storage path of rider signature PNG
  add column if not exists guardian_signature_path text,
  add column if not exists signer_user_agent text,
  add column if not exists consent_text text;            -- the e-sign consent sentence they ticked

create index if not exists waivers_sign_token_idx on public.waivers (sign_token) where sign_token is not null;

-- ---------------------------------------------------------------
-- Public access for the signing page: two functions keyed on the token.
-- The anon role can call ONLY these; it still cannot read any table.
-- ---------------------------------------------------------------

-- What the signing page needs to render. Returns nothing if the token is
-- unknown, expired, or already used.
create or replace function public.get_waiver_for_signing(p_token text)
returns table (
  title text,
  body text,
  rider_name text,
  requires_guardian_for_minors boolean,
  signed boolean,
  expired boolean
)
language sql security definer set search_path = public stable as $$
  select
    w.title,
    coalesce(w.body_snapshot, t.body, '') as body,
    c.full_name as rider_name,
    coalesce(t.requires_guardian_for_minors, true),
    w.signed_at is not null as signed,
    (w.token_expires_at is not null and w.token_expires_at < now()) as expired
  from public.waivers w
  left join public.waiver_templates t on t.id = w.template_id
  left join public.clients c on c.id = w.client_id
  where w.sign_token = p_token
    and length(p_token) >= 32
  limit 1
$$;

-- Record a signature. Signature images are uploaded by the signing page to
-- storage first (see policy below); this stores their paths and marks signed.
create or replace function public.submit_waiver_signature(
  p_token text,
  p_signer_name text,
  p_is_minor boolean,
  p_guardian_name text,
  p_signature_path text,
  p_guardian_signature_path text,
  p_user_agent text,
  p_consent_text text
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  w public.waivers%rowtype;
  t public.waiver_templates%rowtype;
begin
  select * into w from public.waivers
    where sign_token = p_token and length(p_token) >= 32
    for update;
  if not found then return false; end if;
  if w.signed_at is not null then return false; end if;
  if w.token_expires_at is not null and w.token_expires_at < now() then return false; end if;
  if coalesce(trim(p_signer_name), '') = '' or coalesce(p_signature_path, '') = '' then
    raise exception 'A name and signature are required.';
  end if;

  select * into t from public.waiver_templates where id = w.template_id;
  if p_is_minor and coalesce(t.requires_guardian_for_minors, true)
     and (coalesce(trim(p_guardian_name), '') = '' or coalesce(p_guardian_signature_path, '') = '') then
    raise exception 'A parent or guardian name and signature are required for riders under 18.';
  end if;

  update public.waivers set
    status = 'signed',
    signed_at = now(),
    signed_on = current_date,
    expires_on = case when t.valid_days is not null then current_date + t.valid_days else expires_on end,
    signer_name = trim(p_signer_name),
    signer_is_minor = p_is_minor,
    guardian_name = nullif(trim(p_guardian_name), ''),
    signature_path = p_signature_path,
    guardian_signature_path = nullif(p_guardian_signature_path, ''),
    signer_user_agent = left(p_user_agent, 500),
    consent_text = p_consent_text,
    body_snapshot = coalesce(body_snapshot, t.body),
    sign_token = null,                -- single use
    updated_at = now()
  where id = w.id;
  return true;
end $$;

revoke all on function public.get_waiver_for_signing(text) from public;
revoke all on function public.submit_waiver_signature(text, text, boolean, text, text, text, text, text) from public;
grant execute on function public.get_waiver_for_signing(text) to anon, authenticated;
grant execute on function public.submit_waiver_signature(text, text, boolean, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- Storage: signers (anon) may upload a signature PNG into
-- documents/signatures/<token>/..., and nothing else. They cannot read it back.
-- ---------------------------------------------------------------
drop policy if exists "signer upload signature" on storage.objects;
create policy "signer upload signature" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'signatures'
    and exists (
      select 1 from public.waivers w
      where w.sign_token = (storage.foldername(name))[2]
        and w.signed_at is null
        and (w.token_expires_at is null or w.token_expires_at > now())
    )
  );
