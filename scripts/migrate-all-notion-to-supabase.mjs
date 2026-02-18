import fs from "node:fs";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return;
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function text(prop) {
  if (!prop) return "";
  if (Array.isArray(prop.title)) return prop.title.map((x) => x?.plain_text || "").join("");
  if (Array.isArray(prop.rich_text)) return prop.rich_text.map((x) => x?.plain_text || "").join("");
  return "";
}

function selectName(prop) {
  return prop?.select?.name || prop?.status?.name || "";
}

function dateStart(prop) {
  return prop?.date?.start || "";
}

function emailValue(prop) {
  return prop?.email || "";
}

function urlValue(prop) {
  return prop?.url || text(prop) || "";
}

function numberValue(prop) {
  if (typeof prop?.number === "number" && Number.isFinite(prop.number)) return prop.number;
  const n = Number.parseFloat(String(text(prop) || selectName(prop) || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function multiSelect(prop) {
  if (!Array.isArray(prop?.multi_select)) return [];
  return prop.multi_select.map((x) => String(x?.name || "").trim()).filter(Boolean);
}

function relationIds(prop) {
  if (!Array.isArray(prop?.relation)) return [];
  return prop.relation.map((x) => x?.id).filter(Boolean);
}

function titleFromProps(props) {
  for (const key of Object.keys(props || {})) {
    if (props[key]?.type === "title") return text(props[key]);
  }
  return "";
}

function propByKeys(props, keys) {
  for (const key of keys) {
    if (props[key]) return props[key];
  }
  return null;
}

function splitList(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function chunk(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

function normalizeVisibility(value) {
  return String(value || "").trim().toLowerCase() === "public" ? "Public" : "Private";
}

function normalizeStage(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s === "idea" || s === "mvp" || s === "beta" || s === "launched") return s;
  return "idea";
}

function normalizeWorkStyle(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s === "async" || s === "sync" || s === "hybrid") return s;
  return "hybrid";
}

function normalizeCommitment(value) {
  const s = String(value || "").trim();
  if (["1-5", "6-10", "11-20", "21-40", "40+"].includes(s)) return s;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (n <= 5) return "1-5";
  if (n <= 10) return "6-10";
  if (n <= 20) return "11-20";
  if (n <= 40) return "21-40";
  return "40+";
}

function normalizeRequestStatus(value) {
  const s = String(value || "").trim().toUpperCase();
  if (s === "ACCEPTED" || s === "PENDING" || s === "DECLINED") return s;
  if (s === "REJECTED") return "DECLINED";
  return "PENDING";
}

function normalizeRole(value) {
  const s = String(value || "").trim();
  if (s === "Owner" || s === "Admin" || s === "Member") return s;
  return "Member";
}

function normalizeMemberStatus(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s === "active") return "Active";
  if (s === "away") return "Away";
  return "Inactive";
}

function parseSeenMap(value) {
  try {
    const parsed = JSON.parse(String(value || "").trim() || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function parseDmParticipantsFromThreadId(threadId) {
  const value = String(threadId || "").trim();
  if (!value.toLowerCase().startsWith("dm::")) return [];
  return dedupe(value.split("::").slice(1).map((x) => x.trim()).filter(Boolean)).slice(0, 2);
}

async function notionRequest(endpoint, method, body) {
  const token = String(process.env.NOTION_TOKEN || "").trim();
  if (!token) throw new Error("Missing NOTION_TOKEN");
  const maxAttempts = 4;
  let lastStatus = 0;
  let lastText = "";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.json();
    lastStatus = res.status;
    lastText = await res.text();
    if (res.status !== 429 || attempt >= maxAttempts - 1) break;
    const waitMs = Math.min(500 * (2 ** attempt) + Math.floor(Math.random() * 120), 6000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  throw new Error(`Notion API Error [${lastStatus}]: ${lastText}`);
}

async function queryAllNotionPages(databaseId) {
  if (!databaseId) return [];
  const out = [];
  let cursor = undefined;
  while (true) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const result = await notionRequest(`/databases/${databaseId}/query`, "POST", body);
    out.push(...(result.results || []));
    if (!result.has_more || !result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return out;
}

async function supabaseUpsert(table, conflictColumns, rows) {
  if (!rows.length) return;
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const endpoint = `${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictColumns)}`;
  for (const rowsChunk of chunk(rows, 200)) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rowsChunk),
    });
    if (!res.ok) {
      throw new Error(`Supabase upsert failed [${table}] ${res.status}: ${await res.text()}`);
    }
  }
}

async function main() {
  loadEnv();

  const dbIds = {
    users: process.env.NOTION_DB_USERS || "",
    teams: process.env.NOTION_DB_TEAMS || "",
    teamMembers: process.env.NOTION_DB_TEAM_MEMBERS || "",
    chatRequests: process.env.NOTION_DB_CHAT_REQUESTS || "",
    teamInvites: process.env.NOTION_DB_TEAM_INVITES || "",
    joinRequests: process.env.NOTION_DB_TEAM_JOIN_REQUESTS || process.env.NOTION_DB_JOIN_REQUESTS || "",
    threads: process.env.NOTION_DB_THREADS || "",
    messages: process.env.NOTION_DB_MESSAGES || "",
    links: process.env.NOTION_DB_LINKS || "",
    files: process.env.NOTION_DB_FILES || "",
    tasks: process.env.NOTION_DB_TASKS || "",
    meetingNotes: process.env.NOTION_DB_MEETING_NOTES || "",
    agreementNotes: process.env.NOTION_DB_AGREEMENT_NOTES || "",
    comments: process.env.NOTION_DB_COMMENTS || "",
  };

  const notionRows = {};
  for (const [key, dbId] of Object.entries(dbIds)) {
    notionRows[key] = await queryAllNotionPages(dbId);
    console.log(`[notion] ${key}: ${notionRows[key].length}`);
  }

  const userIdByPageId = new Map();
  const teamIdByPageId = new Map();
  const threadIdByPageId = new Map();

  const profiles = [];
  for (const page of notionRows.users) {
    const p = page.properties || {};
    const userId = text(propByKeys(p, ["user_id"])) || page.id;
    const email = emailValue(propByKeys(p, ["email"])) || `${userId}@migrated.local`;
    const username = text(propByKeys(p, ["username", "name", "Name"])) || titleFromProps(p) || "Unknown";
    const skills = dedupe([
      ...multiSelect(propByKeys(p, ["skills"])),
      ...splitList(text(propByKeys(p, ["skills"]))),
    ]);
    const availabilityRaw =
      selectName(propByKeys(p, ["availability_hours_per_week"])) ||
      text(propByKeys(p, ["availability_hours_per_week"])) ||
      String(numberValue(propByKeys(p, ["availability_hours_per_week"])) || "");

    userIdByPageId.set(page.id, userId);
    profiles.push({
      user_id: userId,
      email,
      username,
      password_hash: text(propByKeys(p, ["password_hash"])) || null,
      image_url: null,
      country: selectName(propByKeys(p, ["country"])) || text(propByKeys(p, ["country"])) || null,
      language: selectName(propByKeys(p, ["language"])) || text(propByKeys(p, ["language"])) || null,
      skills,
      availability_hours_per_week: normalizeCommitment(availabilityRaw),
      availability_start: dateStart(propByKeys(p, ["availability_start"])) || null,
      portfolio_links: splitList(text(propByKeys(p, ["portfolio_links"]))),
      bio: text(propByKeys(p, ["bio"])) || "",
    });
  }
  await supabaseUpsert("profiles", "user_id", profiles);

  const teams = [];
  for (const page of notionRows.teams) {
    const p = page.properties || {};
    const teamId = text(propByKeys(p, ["team_id"])) || page.id;
    const ownerText = text(propByKeys(p, ["primary_owner_user_id"]));
    const ownerRel = relationIds(propByKeys(p, ["primary_owner_user_id", "primary_owner"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    const ownerId = ownerText || ownerRel || profiles[0]?.user_id || "";
    if (!ownerId) continue;

    const roles = dedupe([
      ...multiSelect(propByKeys(p, ["recruiting_roles"])),
      ...splitList(text(propByKeys(p, ["recruiting_roles"]))),
    ]);

    teamIdByPageId.set(page.id, teamId);
    teams.push({
      team_id: teamId,
      name: text(propByKeys(p, ["team_name", "name", "Name"])) || titleFromProps(p) || teamId,
      description: text(propByKeys(p, ["description", "one_liner"])) || "",
      visibility: normalizeVisibility(selectName(propByKeys(p, ["visibility"])) || text(propByKeys(p, ["visibility"]))),
      primary_owner_user_id: ownerId,
      recruiting_roles: roles,
      language: selectName(propByKeys(p, ["language"])) || text(propByKeys(p, ["language"])) || null,
      stage: normalizeStage(selectName(propByKeys(p, ["stage"])) || text(propByKeys(p, ["stage"]))),
      timezone: selectName(propByKeys(p, ["timezone"])) || text(propByKeys(p, ["timezone"])) || null,
      team_size: Math.max(1, Math.floor(numberValue(propByKeys(p, ["team_size"])) || 1)),
      open_slots: Math.max(0, Math.floor(numberValue(propByKeys(p, ["open_slots"])) || 0)),
      commitment_hours_per_week: normalizeCommitment(
        selectName(propByKeys(p, ["commitment_hours_per_week"])) ||
        text(propByKeys(p, ["commitment_hours_per_week"])) ||
        String(numberValue(propByKeys(p, ["commitment_hours_per_week"])) || "")
      ),
      work_style: normalizeWorkStyle(selectName(propByKeys(p, ["work_style"])) || text(propByKeys(p, ["work_style"]))),
      created_at: dateStart(propByKeys(p, ["created_at"])) || page.created_time,
    });
  }
  await supabaseUpsert("teams", "team_id", teams);

  const teamMembers = [];
  const teamMemberKeys = new Set();
  for (const page of notionRows.teamMembers) {
    const p = page.properties || {};
    const teamText = text(propByKeys(p, ["team_id"]));
    const userText = text(propByKeys(p, ["user_id"]));
    const teamRel = relationIds(propByKeys(p, ["team", "team_id"])).map((id) => teamIdByPageId.get(id)).find(Boolean) || "";
    const userRel = relationIds(propByKeys(p, ["user", "user_id"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    const teamId = teamText || teamRel || "";
    const userId = userText || userRel || "";
    if (!teamId || !userId) continue;
    const dedupKey = `${teamId}:${userId}`;
    if (teamMemberKeys.has(dedupKey)) continue;
    teamMemberKeys.add(dedupKey);
    teamMembers.push({
      team_id: teamId,
      user_id: userId,
      role: normalizeRole(selectName(propByKeys(p, ["role"])) || text(propByKeys(p, ["role"]))),
      status: normalizeMemberStatus(selectName(propByKeys(p, ["status"])) || text(propByKeys(p, ["status"]))),
      joined_at: dateStart(propByKeys(p, ["joined_at"])) || page.created_time,
    });
  }

  for (const team of teams) {
    const key = `${team.team_id}:${team.primary_owner_user_id}`;
    if (teamMemberKeys.has(key)) continue;
    teamMemberKeys.add(key);
    teamMembers.push({
      team_id: team.team_id,
      user_id: team.primary_owner_user_id,
      role: "Owner",
      status: "Active",
      joined_at: team.created_at || new Date().toISOString(),
    });
  }
  await supabaseUpsert("team_members", "team_id,user_id", teamMembers);

  const chatRequests = [];
  for (const page of notionRows.chatRequests) {
    const p = page.properties || {};
    const fromText = text(propByKeys(p, ["from_user_id"]));
    const toText = text(propByKeys(p, ["to_user_id"]));
    const fromRel = relationIds(propByKeys(p, ["from_user_id", "from_user"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    const toRel = relationIds(propByKeys(p, ["to_user_id", "to_user"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    const fromUserId = fromText || fromRel || "";
    const toUserId = toText || toRel || "";
    if (!fromUserId || !toUserId) continue;
    chatRequests.push({
      request_id: text(propByKeys(p, ["chat_request_id", "request_id"])) || page.id,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      message: text(propByKeys(p, ["message", "request_message", "note"])) || "",
      status: normalizeRequestStatus(selectName(propByKeys(p, ["status"])) || text(propByKeys(p, ["status"]))),
      created_at: dateStart(propByKeys(p, ["created_at"])) || page.created_time,
    });
  }
  await supabaseUpsert("chat_requests", "request_id", chatRequests);

  const teamInvites = [];
  for (const page of notionRows.teamInvites) {
    const p = page.properties || {};
    const teamText = text(propByKeys(p, ["team_id"]));
    const inviterText = text(propByKeys(p, ["inviter_user_id"]));
    const inviteeText = text(propByKeys(p, ["invitee_user_id"]));
    const teamRel = relationIds(propByKeys(p, ["team", "team_id"])).map((id) => teamIdByPageId.get(id)).find(Boolean) || "";
    const inviterRel = relationIds(propByKeys(p, ["inviter_user_id", "inviter"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    const inviteeRel = relationIds(propByKeys(p, ["invitee_user_id", "invitee"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    const teamId = teamText || teamRel || "";
    const inviterUserId = inviterText || inviterRel || "";
    const inviteeUserId = inviteeText || inviteeRel || "";
    if (!teamId || !inviterUserId || !inviteeUserId) continue;
    teamInvites.push({
      invite_id: text(propByKeys(p, ["invite_id", "request_id"])) || page.id,
      team_id: teamId,
      inviter_user_id: inviterUserId,
      invitee_user_id: inviteeUserId,
      message: text(propByKeys(p, ["message", "request_message", "note"])) || "",
      status: normalizeRequestStatus(selectName(propByKeys(p, ["status"])) || text(propByKeys(p, ["status"]))),
      created_at: dateStart(propByKeys(p, ["created_at"])) || page.created_time,
    });
  }
  await supabaseUpsert("team_invites", "invite_id", teamInvites);

  const joinRequests = [];
  for (const page of notionRows.joinRequests) {
    const p = page.properties || {};
    const teamText = text(propByKeys(p, ["team_id"]));
    const applicantText = text(propByKeys(p, ["applicant_user_id"]));
    const teamRel = relationIds(propByKeys(p, ["team", "team_id"])).map((id) => teamIdByPageId.get(id)).find(Boolean) || "";
    const applicantRel = relationIds(propByKeys(p, ["applicant_user_id", "applicant"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    const teamId = teamText || teamRel || "";
    const applicantUserId = applicantText || applicantRel || "";
    if (!teamId || !applicantUserId) continue;
    joinRequests.push({
      join_request_id: text(propByKeys(p, ["join_request_id", "request_id"])) || page.id,
      team_id: teamId,
      applicant_user_id: applicantUserId,
      answer_1: text(propByKeys(p, ["answer_1"])) || "",
      answer_2: text(propByKeys(p, ["answer_2"])) || "",
      status: normalizeRequestStatus(selectName(propByKeys(p, ["status"])) || text(propByKeys(p, ["status"]))),
      created_at: dateStart(propByKeys(p, ["created_at"])) || page.created_time,
    });
  }
  await supabaseUpsert("join_requests", "join_request_id", joinRequests);

  const threads = [];
  for (const page of notionRows.threads) {
    const p = page.properties || {};
    const rawThreadId = text(propByKeys(p, ["thread_id"])) || "";
    const typeRaw = selectName(propByKeys(p, ["type"])) || text(propByKeys(p, ["type"])) || "DM";
    const type = String(typeRaw).trim().toLowerCase() === "team" ? "TEAM" : "DM";
    const teamText = text(propByKeys(p, ["team_id"]));
    const teamRel = relationIds(propByKeys(p, ["team", "team_id"])).map((id) => teamIdByPageId.get(id)).find(Boolean) || "";
    const teamId = teamText || teamRel || null;

    let participants = [];
    const participantProp = propByKeys(p, ["participants_user_ids", "participants"]);
    if (Array.isArray(participantProp?.relation)) {
      participants = participantProp.relation.map((rel) => userIdByPageId.get(rel.id)).filter(Boolean);
    } else if (Array.isArray(participantProp?.multi_select)) {
      participants = multiSelect(participantProp);
    } else {
      participants = splitList(text(participantProp));
    }
    participants = dedupe(participants);

    const threadId =
      rawThreadId ||
      (type === "DM" && participants.length >= 2
        ? `dm::${participants.slice(0, 2).sort().join("::")}`
        : page.id);
    if (!participants.length) participants = parseDmParticipantsFromThreadId(threadId);

    threadIdByPageId.set(page.id, threadId);
    threads.push({
      thread_id: threadId,
      type,
      title: titleFromProps(p) || text(propByKeys(p, ["title", "name", "Name"])) || "Chat",
      team_id: type === "TEAM" ? teamId : null,
      participants_user_ids: type === "DM" ? participants : [],
      dm_seen_map: type === "DM" ? parseSeenMap(text(propByKeys(p, ["dm_seen_map", "seen_map", "read_map"]))) : {},
      created_at: dateStart(propByKeys(p, ["created_at"])) || page.created_time,
      last_message_at: dateStart(propByKeys(p, ["last_message_at"])) || page.last_edited_time || page.created_time,
    });
  }
  await supabaseUpsert("threads", "thread_id", threads);

  const messages = [];
  for (const page of notionRows.messages) {
    const p = page.properties || {};
    const threadText = text(propByKeys(p, ["thread_id"]));
    const senderText = text(propByKeys(p, ["sender_user_id"]));
    const threadRel = relationIds(propByKeys(p, ["thread", "thread_id"])).map((id) => threadIdByPageId.get(id)).find(Boolean) || "";
    const senderRel = relationIds(propByKeys(p, ["sender", "sender_user_id"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    const threadId = threadText || threadRel || "";
    const senderUserId = senderText || senderRel || "";
    const bodyOriginal = text(propByKeys(p, ["body_original", "body", "content"])) || "";
    if (!threadId || !senderUserId || !bodyOriginal) continue;
    messages.push({
      message_id: text(propByKeys(p, ["message_id"])) || page.id,
      thread_id: threadId,
      sender_user_id: senderUserId,
      body_original: bodyOriginal,
      body_translated: text(propByKeys(p, ["body_translated"])) || null,
      translated_lang: text(propByKeys(p, ["translated_lang", "lang_target"])) || null,
      created_at: dateStart(propByKeys(p, ["created_at"])) || page.created_time,
    });
  }
  await supabaseUpsert("messages", "message_id", messages);

  function teamIdForWorkspace(props) {
    const teamText = text(propByKeys(props, ["team_id"]));
    const teamRel = relationIds(propByKeys(props, ["team", "team_id"])).map((id) => teamIdByPageId.get(id)).find(Boolean) || "";
    return teamText || teamRel || "";
  }

  const workspaceLinks = notionRows.links.map((page) => {
    const p = page.properties || {};
    return {
      link_id: text(propByKeys(p, ["link_id"])) || page.id,
      team_id: teamIdForWorkspace(p),
      title: text(propByKeys(p, ["title", "name", "Name"])) || titleFromProps(p) || "Link",
      url: urlValue(propByKeys(p, ["url", "link"])) || "",
      created_at: page.created_time,
    };
  }).filter((x) => x.team_id);
  await supabaseUpsert("workspace_links", "link_id", workspaceLinks);

  const workspaceFiles = notionRows.files.map((page) => {
    const p = page.properties || {};
    return {
      file_id: text(propByKeys(p, ["file_id"])) || page.id,
      team_id: teamIdForWorkspace(p),
      title: text(propByKeys(p, ["title", "name", "Name"])) || titleFromProps(p) || "File",
      url: urlValue(propByKeys(p, ["url", "file_url"])) || null,
      created_at: page.created_time,
    };
  }).filter((x) => x.team_id);
  await supabaseUpsert("workspace_files", "file_id", workspaceFiles);

  const workspaceTasks = notionRows.tasks.map((page) => {
    const p = page.properties || {};
    const statusRaw = selectName(propByKeys(p, ["status"])) || text(propByKeys(p, ["status"])) || "To Do";
    return {
      task_id: text(propByKeys(p, ["task_id"])) || page.id,
      team_id: teamIdForWorkspace(p),
      title: text(propByKeys(p, ["title", "name", "Name"])) || titleFromProps(p) || "Task",
      status: String(statusRaw).toLowerCase().includes("done") ? "Done" : "To Do",
      created_at: page.created_time,
      updated_at: page.last_edited_time || page.created_time,
    };
  }).filter((x) => x.team_id);
  await supabaseUpsert("workspace_tasks", "task_id", workspaceTasks);

  const workspaceMeetingNotes = notionRows.meetingNotes.map((page) => {
    const p = page.properties || {};
    return {
      meeting_note_id: text(propByKeys(p, ["meeting_note_id"])) || page.id,
      team_id: teamIdForWorkspace(p),
      title: text(propByKeys(p, ["title", "name", "Name"])) || titleFromProps(p) || "Meeting Note",
      content: text(propByKeys(p, ["content", "body", "note"])) || "",
      created_at: page.created_time,
    };
  }).filter((x) => x.team_id);
  await supabaseUpsert("workspace_meeting_notes", "meeting_note_id", workspaceMeetingNotes);

  const workspaceAgreementNotes = notionRows.agreementNotes.map((page) => {
    const p = page.properties || {};
    return {
      agreement_note_id: text(propByKeys(p, ["agreement_note_id"])) || page.id,
      team_id: teamIdForWorkspace(p),
      body: text(propByKeys(p, ["body", "content"])) || "",
      footer_notice: text(propByKeys(p, ["footer_notice", "footer"])) || "",
      created_at: page.created_time,
      updated_at: page.last_edited_time || page.created_time,
    };
  }).filter((x) => x.team_id);
  await supabaseUpsert("workspace_agreement_notes", "agreement_note_id", workspaceAgreementNotes);

  const workspaceComments = notionRows.comments.map((page) => {
    const p = page.properties || {};
    const authorText = text(propByKeys(p, ["author_user_id", "user_id"]));
    const authorRel = relationIds(propByKeys(p, ["author", "author_user_id", "user"])).map((id) => userIdByPageId.get(id)).find(Boolean) || "";
    return {
      comment_id: text(propByKeys(p, ["comment_id"])) || page.id,
      team_id: teamIdForWorkspace(p),
      author_user_id: authorText || authorRel || "",
      body: text(propByKeys(p, ["body", "comment", "content"])) || "",
      created_at: page.created_time,
    };
  }).filter((x) => x.team_id && x.author_user_id);
  await supabaseUpsert("workspace_comments", "comment_id", workspaceComments);

  console.log("[supabase] profiles:", profiles.length);
  console.log("[supabase] teams:", teams.length);
  console.log("[supabase] team_members:", teamMembers.length);
  console.log("[supabase] chat_requests:", chatRequests.length);
  console.log("[supabase] team_invites:", teamInvites.length);
  console.log("[supabase] join_requests:", joinRequests.length);
  console.log("[supabase] threads:", threads.length);
  console.log("[supabase] messages:", messages.length);
  console.log("[supabase] workspace_links:", workspaceLinks.length);
  console.log("[supabase] workspace_files:", workspaceFiles.length);
  console.log("[supabase] workspace_tasks:", workspaceTasks.length);
  console.log("[supabase] workspace_meeting_notes:", workspaceMeetingNotes.length);
  console.log("[supabase] workspace_agreement_notes:", workspaceAgreementNotes.length);
  console.log("[supabase] workspace_comments:", workspaceComments.length);
  console.log("Migration completed.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

