/*
  Lightweight E2E smoke checks for auth/security + core API health.
  Usage:
    1) Run app server (npm run dev)
    2) npm run test:e2e

  Optional authenticated checks:
    - E2E_EMAIL
    - E2E_PASSWORD
    - E2E_TEAM_ID (optional, validates workspace access)
*/

const baseUrl = String(process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const e2eEmail = String(process.env.E2E_EMAIL || "").trim();
const e2ePassword = String(process.env.E2E_PASSWORD || "").trim();
const e2eTeamId = String(process.env.E2E_TEAM_ID || "").trim();

const cookieJar = new Map();

function extractSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const one = headers.get("set-cookie");
  return one ? [one] : [];
}

function updateCookieJarFromResponse(res) {
  const setCookies = extractSetCookies(res.headers);
  for (const raw of setCookies) {
    const first = String(raw || "").split(";")[0] || "";
    const sep = first.indexOf("=");
    if (sep <= 0) continue;
    const name = first.slice(0, sep).trim();
    const value = first.slice(sep + 1).trim();
    if (!name) continue;
    cookieJar.set(name, value);
  }
}

function cookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = new Headers(options.headers || {});
  const cookies = cookieHeader();
  if (cookies) headers.set("Cookie", cookies);
  const res = await fetch(url, {
    redirect: "manual",
    ...options,
    headers,
  });
  updateCookieJarFromResponse(res);
  return res;
}

async function expectStatus(path, expectedStatus, options = {}) {
  const res = await request(path, options);
  if (res.status !== expectedStatus) {
    const body = await res.text().catch(() => "");
    throw new Error(`[${path}] expected ${expectedStatus}, got ${res.status}\n${body.slice(0, 400)}`);
  }
  console.log(`ok ${path} -> ${res.status}`);
}

async function expectPage(path) {
  const res = await request(path);
  if (!res.ok) {
    throw new Error(`[${path}] expected 2xx, got ${res.status}`);
  }
  const html = await res.text();
  if (!html || html.length < 40) {
    throw new Error(`[${path}] response body looks invalid`);
  }
  console.log(`ok ${path} -> ${res.status}`);
}

async function expectOkJson(path) {
  const res = await request(path);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[${path}] expected 2xx, got ${res.status}\n${body.slice(0, 400)}`);
  }
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") {
    throw new Error(`[${path}] expected JSON body`);
  }
  console.log(`ok ${path} -> ${res.status}`);
  return json;
}

async function signInWithCredentials() {
  const csrfRes = await request("/api/auth/csrf");
  if (!csrfRes.ok) {
    throw new Error(`Failed to fetch csrf token (${csrfRes.status})`);
  }
  const csrf = await csrfRes.json().catch(() => ({}));
  const csrfToken = String(csrf?.csrfToken || "").trim();
  if (!csrfToken) throw new Error("Missing csrfToken from /api/auth/csrf");

  const form = new URLSearchParams();
  form.set("csrfToken", csrfToken);
  form.set("email", e2eEmail);
  form.set("password", e2ePassword);
  form.set("callbackUrl", `${baseUrl}/discovery`);
  form.set("json", "true");

  const loginRes = await request("/api/auth/callback/credentials?json=true", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (loginRes.status >= 400) {
    const body = await loginRes.text().catch(() => "");
    throw new Error(`Credential login failed (${loginRes.status})\n${body.slice(0, 400)}`);
  }

  const session = await expectOkJson("/api/auth/session");
  if (!session?.user?.email) {
    throw new Error("Session was not established after credential login.");
  }
}

async function run() {
  console.log(`[e2e-smoke] baseUrl=${baseUrl}`);
  await expectPage("/login");
  await expectStatus("/api/requests", 401);
  await expectStatus("/api/chat/messages?threadId=test-thread", 401);
  await expectStatus("/api/workspace/test-team", 401);

  if (!e2eEmail || !e2ePassword) {
    console.log("[e2e-smoke] skipped authenticated checks (set E2E_EMAIL/E2E_PASSWORD)");
    console.log("[e2e-smoke] all checks passed");
    return;
  }

  await signInWithCredentials();
  await expectStatus("/api/requests", 200);
  await expectStatus("/api/chat/alerts", 200);
  await expectStatus("/api/chat/messages?threadId=test-thread", 403);
  await expectStatus("/api/teams", 200);
  if (e2eTeamId) {
    await expectStatus(`/api/workspace/${encodeURIComponent(e2eTeamId)}`, 200);
  }

  console.log("[e2e-smoke] all checks passed");
}

run().catch((error) => {
  console.error("[e2e-smoke] failed:", error);
  process.exit(1);
});
