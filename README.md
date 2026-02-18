# Onbure (Web-first MVP)

A premium team collaboration platform built with Next.js, Tailwind CSS, and Notion as the database.

## Features
- **Discovery**: Find Public Teams and People.
- **Requests**: Inbox for Chat requests and Team invites.
- **Chat**: Live updates via Supabase Realtime signal bus (`audit_logs`) + secure API fetch.
- **Team Workspace**:
  - Links, Files (Mock Upload), Tasks.
  - Agreement Note (with mandatory legal footer).
- **Security Hardening**:
  - Server-side authorization checks on chat/requests/workspace routes.
  - RLS enabled with direct `anon/authenticated` table access revoked (except `audit_logs` realtime signal table).
  - Audit log trail for request/chat/workspace/team mutations.
- **Operations**:
  - Client error tracking endpoint (`/api/monitoring/errors`) for Sentry-like capture baseline.
  - Smoke E2E script (`npm run test:e2e`) for core auth/security paths.
- **Authentication**: Email/Password login (Data stored in Notion).

## Setup Instructions

### 1. Prerequisites
- Node.js installed.
- Notion Account.

### 2. Notion Setup (Crucial)
You must create the following Databases in Notion and get their IDs.
Make sure to create an **Internal Integration** at [Notion Developers](https://www.notion.so/my-integrations) and give it access to the page containing these databases.

#### Required Databases & Properties (Case Sensitive)

| Database Name | Required Properties |
|--|--|
| **Users** | `Name` (Title), `Email` (Email), `Password` (Text), `user_id` (Text), `AvatarUrl` (Text) |
| **Teams** | `Name` (Title), `Description` (Text), `Visibility` (Select: "Public"/"Private"), `team_id` (Text), `owner_ids` (Text), `member_ids` (Text) |
| **Requests** | `request_id` (Text), `Type` (Select: "CHAT"/"INVITE"/"JOIN"), `from_user_id` (Text), `to_id` (Text), `Status` (Select: "PENDING"/"ACCEPTED"/"DECLINED"), `Message` (Text) |
| **Threads** | `Name` (Title), `Type` (Select: "DM"/"TEAM"), `thread_id` (Text), `participants` (Text) |
| **Messages** | `Content` (Title), `Translated` (Text), `sender_id` (Text), `thread_id` (Text) |
| **Workspace Links** | `Name` (Title), `URL` (URL), `team_id` (Text) |
| **Workspace Files** | `Name` (Title), `URL` (URL), `team_id` (Text) |
| **Workspace Tasks** | `Name` (Title), `Status` (Select: "To Do"/"Done"), `team_id` (Text) |
| **Meeting Notes** | `Name` (Title), `Content` (Text), `team_id` (Text) |
| **Agreement Notes** | `Name` (Title), `Content` (Text), `team_id` (Text) |

### 3. Environment Variables
1. Copy `.env.example` to `.env.local`.
2. Fill in `NOTION_TOKEN` (from your Integration).
3. Fill in DB IDs. You can use the `NOTION_DB_*` keys listed above.
4. **Aliases Supported**: If you prefer, you can use:
    - `NOTION_DB_CHAT_THREADS` instead of `NOTION_DB_THREADS`
    - `NOTION_DB_CHAT_MESSAGES` instead of `NOTION_DB_MESSAGES`
    - `NOTION_DB_JOIN_REQUESTS` or `NOTION_DB_TEAM_INVITES` instead of `NOTION_DB_REQUESTS` (Unified)
5. `NEXTAUTH_SECRET`: Run `openssl rand -base64 32` to generate one.

### 4. Run the Project
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`.

## Supabase Migration (All Data)
Use this when migrating away from Notion.

1. Set environment:
   - `DATA_BACKEND=supabase`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Open Supabase SQL Editor and run: `supabase/schema.sql`
   - Includes `audit_logs` table + realtime publication registration.
3. Validate connectivity:
   - `GET /api/health/supabase`
4. Keep Notion envs during transition, then remove once all DB modules are switched.

## E2E Smoke Test
After `npm run dev` is running:
```bash
npm run test:e2e
```
Optional:
```bash
E2E_BASE_URL=http://127.0.0.1:3010 npm run test:e2e
```

## Notes
- **Email Logic**: Disabled by default (`EMAIL_ENABLED=false`).
- **Translation**: This is a **Mock** implementation. It appends `[TargetLang]` to messages.
- **Security**: Passwords are hashed with bcrypt but stored in Notion. Use for prototype only.
