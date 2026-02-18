/*
  Lightweight E2E smoke checks for core security paths.
  Usage:
    1) Run app server (npm run dev)
    2) npm run test:e2e
*/

const baseUrl = String(process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

async function expectStatus(path, expectedStatus) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, { redirect: "manual" });
  if (res.status !== expectedStatus) {
    const body = await res.text().catch(() => "");
    throw new Error(`[${path}] expected ${expectedStatus}, got ${res.status}\n${body.slice(0, 400)}`);
  }
  console.log(`ok ${path} -> ${res.status}`);
}

async function expectPage(path) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, { redirect: "manual" });
  if (!res.ok) {
    throw new Error(`[${path}] expected 2xx, got ${res.status}`);
  }
  const html = await res.text();
  if (!html || html.length < 40) {
    throw new Error(`[${path}] response body looks invalid`);
  }
  console.log(`ok ${path} -> ${res.status}`);
}

async function run() {
  console.log(`[e2e-smoke] baseUrl=${baseUrl}`);
  await expectPage("/login");
  await expectStatus("/api/requests", 401);
  await expectStatus("/api/chat/messages?threadId=test-thread", 401);
  await expectStatus("/api/workspace/test-team", 401);
  console.log("[e2e-smoke] all checks passed");
}

run().catch((error) => {
  console.error("[e2e-smoke] failed:", error);
  process.exit(1);
});

