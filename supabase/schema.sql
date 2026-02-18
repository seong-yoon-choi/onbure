-- Onbure Supabase Schema (all core product data)
-- Run in Supabase SQL editor once.

create extension if not exists pgcrypto;

-- Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- USERS / PROFILE
create table if not exists public.profiles (
  user_id text primary key,
  email text not null unique,
  username text not null,
  public_code text unique,
  password_hash text,
  image_url text,
  country text,
  language text,
  skills text[] not null default '{}'::text[],
  availability_hours_per_week text,
  availability_start date,
  portfolio_links text[] not null default '{}'::text[],
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table if exists public.profiles
  add column if not exists public_code text;

create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_profiles_username on public.profiles (username);
create unique index if not exists idx_profiles_public_code on public.profiles (public_code) where public_code is not null;

-- TEAMS
create table if not exists public.teams (
  team_id text primary key,
  name text not null,
  description text not null default '',
  visibility text not null default 'Private' check (visibility in ('Public', 'Private')),
  primary_owner_user_id text not null references public.profiles(user_id) on delete restrict,
  recruiting_roles text[] not null default '{}'::text[],
  language text,
  stage text not null default 'idea' check (stage in ('idea', 'mvp', 'beta', 'launched')),
  timezone text,
  team_size integer not null default 1,
  open_slots integer not null default 0,
  commitment_hours_per_week text check (commitment_hours_per_week in ('1-5', '6-10', '11-20', '21-40', '40+')),
  work_style text not null default 'hybrid' check (work_style in ('async', 'sync', 'hybrid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

create index if not exists idx_teams_visibility on public.teams (visibility);
create index if not exists idx_teams_owner on public.teams (primary_owner_user_id);

-- TEAM MEMBERSHIP
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(team_id) on delete cascade,
  user_id text not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('Owner', 'Admin', 'Member')),
  status text not null default 'Active' check (status in ('Active', 'Away', 'Inactive')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists idx_team_members_user on public.team_members (user_id);
create index if not exists idx_team_members_team on public.team_members (team_id);
create index if not exists idx_team_members_team_status on public.team_members (team_id, status);

-- REQUESTS
create table if not exists public.chat_requests (
  request_id text primary key,
  from_user_id text not null references public.profiles(user_id) on delete cascade,
  to_user_id text not null references public.profiles(user_id) on delete cascade,
  message text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_requests_to on public.chat_requests (to_user_id);
create index if not exists idx_chat_requests_pair on public.chat_requests (from_user_id, to_user_id);
create index if not exists idx_chat_requests_status on public.chat_requests (status);

create table if not exists public.team_invites (
  invite_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  inviter_user_id text not null references public.profiles(user_id) on delete cascade,
  invitee_user_id text not null references public.profiles(user_id) on delete cascade,
  message text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at timestamptz not null default now()
);

create index if not exists idx_team_invites_team on public.team_invites (team_id);
create index if not exists idx_team_invites_invitee on public.team_invites (invitee_user_id);
create index if not exists idx_team_invites_status on public.team_invites (status);

create table if not exists public.join_requests (
  join_request_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  applicant_user_id text not null references public.profiles(user_id) on delete cascade,
  answer_1 text not null default '',
  answer_2 text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at timestamptz not null default now()
);

create index if not exists idx_join_requests_team on public.join_requests (team_id);
create index if not exists idx_join_requests_applicant on public.join_requests (applicant_user_id);
create index if not exists idx_join_requests_status on public.join_requests (status);

create table if not exists public.file_share_requests (
  request_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  file_id text not null,
  file_name text not null default '',
  file_url text not null default '',
  from_user_id text not null references public.profiles(user_id) on delete cascade,
  to_user_id text not null references public.profiles(user_id) on delete cascade,
  message text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at timestamptz not null default now()
);

create index if not exists idx_file_share_requests_to on public.file_share_requests (to_user_id);
create index if not exists idx_file_share_requests_from on public.file_share_requests (from_user_id);
create index if not exists idx_file_share_requests_team_file on public.file_share_requests (team_id, file_id);
create index if not exists idx_file_share_requests_status on public.file_share_requests (status);

-- CHAT
create table if not exists public.threads (
  thread_id text primary key,
  type text not null check (type in ('DM', 'TEAM')),
  title text not null default 'Chat',
  team_id text references public.teams(team_id) on delete cascade,
  participants_user_ids text[] not null default '{}'::text[],
  dm_seen_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists idx_threads_type on public.threads (type);
create index if not exists idx_threads_team on public.threads (team_id);
create index if not exists idx_threads_last_message_at on public.threads (last_message_at desc);

create table if not exists public.thread_members (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null references public.threads(thread_id) on delete cascade,
  user_id text not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (thread_id, user_id)
);

create index if not exists idx_thread_members_user on public.thread_members (user_id);

create table if not exists public.messages (
  message_id text primary key,
  thread_id text not null references public.threads(thread_id) on delete cascade,
  sender_user_id text not null references public.profiles(user_id) on delete cascade,
  body_original text not null,
  body_translated text,
  translated_lang text,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_thread_created on public.messages (thread_id, created_at asc);
create index if not exists idx_messages_sender on public.messages (sender_user_id);

-- WORKSPACE
create table if not exists public.workspace_links (
  link_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_links_team on public.workspace_links (team_id);

create table if not exists public.workspace_files (
  file_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  folder_id text references public.workspace_files(file_id) on delete set null,
  title text not null,
  url text,
  created_at timestamptz not null default now()
);

alter table if exists public.workspace_files
  add column if not exists folder_id text;

create index if not exists idx_workspace_files_team on public.workspace_files (team_id);
create index if not exists idx_workspace_files_folder on public.workspace_files (folder_id);

create table if not exists public.workspace_tasks (
  task_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  title text not null,
  status text not null default 'To Do' check (status in ('To Do', 'Done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_workspace_tasks_updated_at on public.workspace_tasks;
create trigger trg_workspace_tasks_updated_at
before update on public.workspace_tasks
for each row execute function public.set_updated_at();

create index if not exists idx_workspace_tasks_team on public.workspace_tasks (team_id);

create table if not exists public.workspace_meeting_notes (
  meeting_note_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_meeting_notes_team on public.workspace_meeting_notes (team_id);

create table if not exists public.workspace_agreement_notes (
  agreement_note_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  body text not null default '',
  footer_notice text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_workspace_agreement_notes_updated_at on public.workspace_agreement_notes;
create trigger trg_workspace_agreement_notes_updated_at
before update on public.workspace_agreement_notes
for each row execute function public.set_updated_at();

create index if not exists idx_workspace_agreement_notes_team on public.workspace_agreement_notes (team_id);

-- Comments are optional but kept for schema parity.
create table if not exists public.workspace_comments (
  comment_id text primary key,
  team_id text not null references public.teams(team_id) on delete cascade,
  author_user_id text not null references public.profiles(user_id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_comments_team on public.workspace_comments (team_id);

-- AUDIT LOGS (for secure realtime fan-out + security audit trail)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('chat', 'request', 'workspace', 'team', 'system')),
  event text not null,
  scope text not null default 'global' check (scope in ('global', 'user', 'team')),
  actor_user_id text references public.profiles(user_id) on delete set null,
  target_user_id text references public.profiles(user_id) on delete set null,
  team_id text references public.teams(team_id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_target_user on public.audit_logs (target_user_id);
create index if not exists idx_audit_logs_team on public.audit_logs (team_id);
create index if not exists idx_audit_logs_category on public.audit_logs (category);

-- RLS (Row Level Security)
-- Current app architecture uses server-side API routes with service-role key.
-- Enabling RLS removes Supabase security warnings and blocks direct anon/auth access
-- unless explicit policies are added later.
alter table if exists public.profiles enable row level security;
alter table if exists public.teams enable row level security;
alter table if exists public.team_members enable row level security;
alter table if exists public.chat_requests enable row level security;
alter table if exists public.team_invites enable row level security;
alter table if exists public.join_requests enable row level security;
alter table if exists public.file_share_requests enable row level security;
alter table if exists public.threads enable row level security;
alter table if exists public.thread_members enable row level security;
alter table if exists public.messages enable row level security;
alter table if exists public.workspace_links enable row level security;
alter table if exists public.workspace_files enable row level security;
alter table if exists public.workspace_tasks enable row level security;
alter table if exists public.workspace_meeting_notes enable row level security;
alter table if exists public.workspace_agreement_notes enable row level security;
alter table if exists public.workspace_comments enable row level security;
alter table if exists public.audit_logs enable row level security;

-- Explicit privilege hardening for direct anon/auth API access.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.teams from anon, authenticated;
revoke all on table public.team_members from anon, authenticated;
revoke all on table public.chat_requests from anon, authenticated;
revoke all on table public.team_invites from anon, authenticated;
revoke all on table public.join_requests from anon, authenticated;
revoke all on table public.file_share_requests from anon, authenticated;
revoke all on table public.threads from anon, authenticated;
revoke all on table public.thread_members from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.workspace_links from anon, authenticated;
revoke all on table public.workspace_files from anon, authenticated;
revoke all on table public.workspace_tasks from anon, authenticated;
revoke all on table public.workspace_meeting_notes from anon, authenticated;
revoke all on table public.workspace_agreement_notes from anon, authenticated;
revoke all on table public.workspace_comments from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

-- Realtime-safe table only: audit_logs (minimal metadata, no source payload rows).
grant select on table public.audit_logs to anon, authenticated;

drop policy if exists audit_logs_select_public on public.audit_logs;
create policy audit_logs_select_public
on public.audit_logs
for select
to anon, authenticated
using (true);

-- Ensure audit_logs is available in supabase realtime publication.
do $$
begin
  alter publication supabase_realtime add table public.audit_logs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- NOTE:
-- 1) This schema is intentionally server-side first (service role via API routes).
-- 2) If client-side Supabase access is needed later, add explicit RLS policies.
