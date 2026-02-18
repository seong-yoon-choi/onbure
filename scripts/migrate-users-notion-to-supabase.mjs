import fs from "node:fs";

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    env[key] = value;
  }
  return env;
}

function readText(prop) {
  if (!prop) return "";
  if (Array.isArray(prop.title)) {
    return prop.title.map((x) => x?.plain_text || "").join("");
  }
  if (Array.isArray(prop.rich_text)) {
    return prop.rich_text.map((x) => x?.plain_text || "").join("");
  }
  return "";
}

function readSelect(prop) {
  return prop?.select?.name || prop?.status?.name || "";
}

function readDate(prop) {
  return prop?.date?.start || "";
}

function readEmail(prop) {
  return prop?.email || "";
}

function readMultiSelect(prop) {
  if (!Array.isArray(prop?.multi_select)) return [];
  return prop.multi_select
    .map((x) => String(x?.name || "").trim())
    .filter(Boolean);
}

function findTitlePropertyName(properties) {
  for (const [key, def] of Object.entries(properties || {})) {
    if (def?.type === "title") return key;
  }
  return null;
}

function splitLinks(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function notionQueryDatabase(token, databaseId, startCursor = null) {
  const body = {
    page_size: 100,
  };
  if (startCursor) body.start_cursor = startCursor;

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Notion query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function upsertProfiles(supabaseUrl, serviceRoleKey, rows) {
  if (!rows.length) return;
  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/profiles?on_conflict=user_id`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Supabase upsert failed: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const env = {
    ...process.env,
    ...(fs.existsSync(".env.local") ? parseEnvFile(".env.local") : {}),
  };

  const notionToken = String(env.NOTION_TOKEN || "").trim();
  const notionUsersDb = String(env.NOTION_DB_USERS || "").trim();
  const supabaseUrl = String(env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!notionToken || !notionUsersDb) {
    throw new Error("Missing NOTION_TOKEN or NOTION_DB_USERS.");
  }
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const pages = [];
  let cursor = null;
  while (true) {
    const result = await notionQueryDatabase(notionToken, notionUsersDb, cursor);
    pages.push(...(result.results || []));
    if (!result.has_more) break;
    cursor = result.next_cursor || null;
    if (!cursor) break;
  }

  const rows = [];
  for (const page of pages) {
    const props = page?.properties || {};
    const titleName = findTitlePropertyName(props);
    const username =
      readText(props.username) ||
      (titleName ? readText(props[titleName]) : "") ||
      readText(props.name) ||
      "Unknown";
    const userId = readText(props.user_id) || page.id;
    const email = readEmail(props.email);
    if (!email) continue;

    const availabilityRaw =
      readSelect(props.availability_hours_per_week) ||
      readText(props.availability_hours_per_week) ||
      "";
    const availability =
      availabilityRaw === "1-5" ||
      availabilityRaw === "6-10" ||
      availabilityRaw === "11-20" ||
      availabilityRaw === "21-40" ||
      availabilityRaw === "40+"
        ? availabilityRaw
        : null;

    rows.push({
      user_id: userId,
      email,
      username,
      password_hash: readText(props.password_hash) || null,
      image_url: props.image?.url || null,
      country: readSelect(props.country) || null,
      language: readSelect(props.language) || null,
      skills: readMultiSelect(props.skills),
      availability_hours_per_week: availability,
      availability_start: readDate(props.availability_start) || null,
      portfolio_links: splitLinks(readText(props.portfolio_links)),
      bio: readText(props.bio) || "",
    });
  }

  await upsertProfiles(supabaseUrl, serviceRoleKey, rows);
  console.log(`Migrated profiles: ${rows.length}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

