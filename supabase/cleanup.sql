-- Cleanup obsolete auth columns from profiles
alter table if exists public.profiles drop column if exists password_hash;
alter table if exists public.profiles drop column if exists email_verified_at;

-- Drop signup_email_codes as it is fully replaced by Supabase Auth
drop table if exists public.signup_email_codes cascade;

-- Remove duplicate indexes left behind by the workspace_qna_feedback -> qna_feedback rename.
drop index if exists public.idx_workspace_qna_feedback_author;
drop index if exists public.idx_workspace_qna_feedback_team_created_at;
