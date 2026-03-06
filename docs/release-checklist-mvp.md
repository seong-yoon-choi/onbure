# Onbure MVP Release Checklist

## 0) Release Meta
- [ ] Release version/tag decided (e.g. `v0.1.x`)
- [ ] Release owner assigned
- [ ] Planned deploy date/time decided
- [ ] Rollback owner assigned
- [ ] User-facing release note draft prepared

## 1) Go / No-Go Criteria
- [ ] P0 bug count = 0
- [ ] P1 bug count = 0
- [ ] Core user flow pass rate = 100%
- [ ] Known limitations documented and shared internally

## 2) Core Product Flows (Manual Smoke)
- [ ] New user registration works (`/register`)
- [ ] Login works (`/login`)
- [ ] Session persistence works after refresh
- [ ] Profile page read/update works (`/profile`)
- [ ] Team creation works
- [ ] Team detail page opens (`/teams/[teamId]`)
- [ ] Discovery list loads and actions work (`/discovery`)
- [ ] Requests inbox loads and accept/reject works (`/requests`)
- [ ] Chat room list opens and message send/receive works (`/chat`)
- [ ] Workspace page opens without error (`/workspace/[teamId]`)
- [ ] Workspace file import works (single/multi)
- [ ] Workspace folder import works
- [ ] Workspace drag and drop works (sidebar <-> canvas)
- [ ] Workspace loading indicator appears during long file render/import actions

## 3) Build, Lint, and Basic Automation
- [ ] `npm install` succeeds on clean machine
- [ ] `npm run lint` passes (or approved warnings only)
- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts locally
- [ ] `npm run test:e2e` passes against running app

## 4) API and Security Checks
- [ ] Unauthorized access to team/chat/workspace APIs is blocked
- [ ] Auth-required routes redirect/deny correctly
- [ ] No sensitive data exposed in client responses
- [ ] Error responses do not leak secrets or internal stack traces
- [ ] Password hashing path works (bcrypt)

## 5) Environment and Secret Validation
- [ ] `DATA_BACKEND=supabase` confirmed in deployment env
- [ ] `NEXTAUTH_URL` set to production URL
- [ ] `NEXTAUTH_SECRET` set (strong random value)
- [ ] `SUPABASE_URL` set
- [ ] `SUPABASE_ANON_KEY` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] Email vars checked (`EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`)
- [ ] OAuth vars checked if OAuth login is enabled
- [ ] Iubenda vars checked if legal widget is enabled

## 6) Supabase / Data Readiness
- [ ] `supabase/schema.sql` applied to target environment
- [ ] `GET /api/health/supabase` returns healthy response
- [ ] Required tables/indices exist
- [ ] RLS policies verified for runtime tables
- [ ] `audit_logs` realtime path verified
- [ ] Backup/snapshot strategy confirmed before deploy

## 7) Observability and Incident Readiness
- [ ] `/api/monitoring/errors` ingestion works
- [ ] Basic dashboard/log view is accessible to on-call
- [ ] Critical alerts (5xx spike, auth failure spike) configured
- [ ] Runbook link prepared for incident handling

## 8) Performance and UX Baseline
- [ ] First load time is acceptable on production-like network
- [ ] Key pages do not freeze on common interactions
- [ ] Workspace interactions stay responsive with realistic file counts
- [ ] Mobile viewport critical pages are usable (login, chat, workspace)

## 9) Deployment Execution
- [ ] Deployment window opened and stakeholders notified
- [ ] Database migration step executed in correct order
- [ ] App deploy completed successfully
- [ ] Post-deploy smoke test completed on production
- [ ] No critical error spike in first 30 minutes

## 10) Rollback Checklist
- [ ] Previous stable build reference recorded
- [ ] Rollback command/procedure tested or documented
- [ ] DB rollback or forward-fix strategy documented
- [ ] Communication template ready for rollback notice

## 11) Post-Release (D+1)
- [ ] Top user flows re-tested with real data
- [ ] Error trends reviewed (24h)
- [ ] Performance trends reviewed (24h)
- [ ] User feedback triaged and prioritized

## Quick Commands
```bash
npm install
npm run lint
npm run build
npm run dev
npm run test:e2e
```

