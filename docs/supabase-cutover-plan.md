# Supabase Cutover Plan

## Goal
Move all runtime product data from Notion to Supabase and remove Notion rate-limit bottlenecks.

## Cutover Phases
1. Foundation
   - Add Supabase env variables.
   - Apply `supabase/schema.sql`.
   - Verify `/api/health/supabase`.
2. Data Migration
   - Export Notion DB rows.
   - Import into Supabase tables with key parity (`user_id`, `team_id`, `thread_id`).
3. API Switch
   - Migrate modules in this order:
     1) `users`
     2) `teams` + `team_members`
     3) `requests`
     4) `threads/messages`
     5) `workspace`
4. Auth Validation
   - Validate login/register/profile edit.
   - Validate discovery/requests/chat/workspace end-to-end.
5. Remove Notion Runtime Usage
   - Keep Notion as docs-only if needed.
   - Delete `NOTION_DB_*` requirement from runtime path.

## Safety Rules
- Keep IDs stable during migration:
  - profiles.user_id = existing app user id
  - teams.team_id = existing team id
  - threads.thread_id = existing thread id
- Do not switch `DATA_BACKEND=supabase` until at least `users`, `teams`, `requests`, `chat`, `workspace` modules are fully migrated.
