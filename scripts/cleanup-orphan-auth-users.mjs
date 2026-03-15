import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = process.cwd();
const applyMode = process.argv.includes("--apply");

function loadEnvFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return;

  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

loadEnvFile(".env.local");

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase admin configuration.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function listAllAuthUsers() {
  const users = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = Array.isArray(data?.users) ? data.users : [];
    users.push(...batch);

    const nextPage = Number(data?.nextPage || 0);
    if (nextPage > page) {
      page = nextPage;
      continue;
    }
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function listAllProfiles() {
  const profiles = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,email")
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const batch = Array.isArray(data) ? data : [];
    profiles.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return profiles;
}

const [authUsers, profiles] = await Promise.all([listAllAuthUsers(), listAllProfiles()]);
const profileUserIds = new Set(
  profiles.map((profile) => String(profile?.user_id || "").trim()).filter(Boolean)
);
const profileEmails = new Set(
  profiles.map((profile) => normalizeEmail(profile?.email)).filter(Boolean)
);

const orphanUsers = authUsers.filter((user) => {
  const userId = String(user?.id || "").trim();
  const email = normalizeEmail(user?.email);
  if (!userId) return false;
  return !profileUserIds.has(userId) && (!email || !profileEmails.has(email));
});

console.log(`Found ${orphanUsers.length} orphan auth user(s).`);
for (const user of orphanUsers) {
  console.log(`- ${user.id} ${normalizeEmail(user.email) || "(no email)"}`);
}

if (!applyMode) {
  console.log("Dry run only. Re-run with --apply to delete these auth users.");
  process.exit(0);
}

for (const user of orphanUsers) {
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`Failed to delete ${user.id}: ${error.message}`);
    continue;
  }
  console.log(`Deleted ${user.id}`);
}
