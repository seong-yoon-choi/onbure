-- Cleanup obsolete auth columns from profiles
alter table if exists public.profiles drop column if exists password_hash;
alter table if exists public.profiles drop column if exists email_verified_at;

-- Drop signup_email_codes as it is fully replaced by Supabase Auth
drop table if exists public.signup_email_codes cascade;
