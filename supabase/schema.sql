-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to create the signups table.
-- Then enable Row Level Security (RLS) and allow only the service role to insert (your serverless function uses the service key).

create table if not exists public.signups (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  primary_stack text,
  priority_lab  boolean not null default false,
  terms_accepted_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  download_sent_at timestamptz,
  constraint signups_email_unique unique (email)
);

-- Optional: index for listing by date or checking if download was sent
create index if not exists signups_created_at_idx on public.signups (created_at desc);
create index if not exists signups_download_sent_at_idx on public.signups (download_sent_at) where download_sent_at is not null;

-- RLS: only backend (service_role) can insert/select/update; no anon access
alter table public.signups enable row level security;

-- Policy: service role bypasses RLS. No policies needed for anon users (they never get direct access).
-- Your Netlify function uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.

comment on table public.signups is 'Early access signups; confirmation email sent on insert; download link sent later via admin.';
