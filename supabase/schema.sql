-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to create the signups table.
-- Then enable Row Level Security (RLS) and allow only the service role to insert (your serverless function uses the service key).

create table if not exists public.signups (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text,
  primary_stack text,
  priority_lab  boolean not null default false,
  terms_accepted_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  download_sent_at timestamptz,
  approved_at   timestamptz,
  invite_sent_at timestamptz,
  constraint signups_email_unique unique (email)
);

-- Optional: index for listing by date or checking if download was sent
create index if not exists signups_created_at_idx on public.signups (created_at desc);
create index if not exists signups_download_sent_at_idx on public.signups (download_sent_at) where download_sent_at is not null;

-- Migration for existing tables (run in Supabase SQL Editor if table already exists):
-- alter table public.signups add column if not exists name text;
-- alter table public.signups add column if not exists approved_at timestamptz;
-- alter table public.signups add column if not exists invite_sent_at timestamptz;

-- RLS: only backend (service_role) can insert/select/update; no anon access
alter table public.signups enable row level security;

-- Policy: service role bypasses RLS. No policies needed for anon users (they never get direct access).
-- Your Netlify function uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.

comment on table public.signups is 'Free trial signups; confirmation email sent on insert; invite sent later via admin.';

-- ─── PAGE VIEWS (analytics) ───────────────────────────────────────────────────

create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  path       text not null,
  referrer   text,
  country    text,
  device     text,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx on public.page_views (path);

alter table public.page_views enable row level security;

comment on table public.page_views is 'Lightweight page view tracking. No IPs or PII stored.';
