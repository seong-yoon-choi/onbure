# Onbure (Web-first MVP)

A premium team collaboration platform built with Next.js, Tailwind CSS, and Supabase.

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
- **Authentication**: Email/Password login (Data stored in Supabase).

## Setup Instructions

### 1. Prerequisites
- Node.js installed.
### 2. Environment Variables
1. Copy `.env.example` to `.env.local`.
2. Set `DATA_BACKEND=supabase`.
3. Fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. `NEXTAUTH_SECRET`: Run `openssl rand -base64 32` to generate one.

### 3. Run the Project
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`.

## Supabase Setup
1. Open Supabase SQL Editor and run: `supabase/schema.sql`
   - Includes `audit_logs` table + realtime publication registration.
2. Validate connectivity:
   - `GET /api/health/supabase`

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
- **Security**: Passwords are hashed with bcrypt and stored in Supabase.
