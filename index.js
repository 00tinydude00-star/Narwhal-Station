const STORE_KEY = "latest";
const REQUESTS_KEY = "requests";
const MAX_NAME = 40;
const MAX_MESSAGE = 500;
const MAX_REQUESTS = 200;
const MAX_TITLE = 240;
const MAX_ARTIST = 120;
const ALLOWED_CHAT_ROLES = new Set(["ADMIN", "OWNER", "VICE_PRINCIPAL", "PRINCIPAL"]);
const ADMIN_COMMAND_KEY = "admin-command";
const MAX_COMMAND_TEXT = 500;
const ALLOWED_ADMIN_COMMANDS = new Set([
  "launch","halloween","snowstorm","thanksgiving","winter","spring","summer","dance","school-assembly",
  "waves","snow","leaves","confetti","rainbow","notes","lock-music","disable-games","unlock-all",
  "emergency","clear-announcement","refresh","narwhal-show","narwhal-dance","narwhal-launch",
  "narwhal-sunglasses","narwhal-halloween","narwhal-winter"
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
    }
  });
}

function adminAuthorized(bodyOrPassword, env) {
  const expected = env.ADMIN_CHAT_PASSWORD;
  if (!expected) return false;
  const supplied = typeof bodyOrPassword === "string" ? bodyOrPassword : bodyOrPassword?.password;
  return supplied === expected;
}

async function handleGlobalChat(request, env) {
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const kv = env.GLOBAL_CHAT;
    if (!kv) return json({ error: "Global Chat is not configured: GLOBAL_CHAT KV binding is missing." }, 500);
    if (request.method === "GET") {
      const message = await kv.get(STORE_KEY, "json");
      return json({ message: message || null });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    if (!env.ADMIN_CHAT_PASSWORD) return json({ error: "Global Chat is not configured: ADMIN_CHAT_PASSWORD secret is missing." }, 500);
    if (!adminAuthorized(body, env)) return json({ error: "Unauthorized." }, 401);
    const role = ALLOWED_CHAT_ROLES.has(String(body.role || "ADMIN").toUpperCase()) ? String(body.role || "ADMIN").toUpperCase() : "ADMIN";
    const name = String(body.name || "").trim().slice(0, MAX_NAME);
    const text = String(body.text || "").trim().slice(0, MAX_MESSAGE);
    if (!name) return json({ error: "Name is required." }, 400);
    if (!text) return json({ error: "Message cannot be empty." }, 400);
    const message = { id: crypto.randomUUID(), name, role, text, time: Date.now() };
    await kv.put(STORE_KEY, JSON.stringify(message));
    return json({ ok: true, message });
  } catch (error) {
    console.error("Narwhal Global Chat error:", error);
    return json({ error: `Global Chat backend error: ${error?.message || "unknown error"}` }, 500);
  }
}

function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

async function handleWeeklyListens(request, env) {
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const kv = env.GLOBAL_CHAT;
    if (!kv) return json({ error: "Weekly listening is not configured: GLOBAL_CHAT KV binding is missing." }, 500);
    const week = isoWeekKey();
    const key = `weekly-listens:${week}`;
    if (request.method === "GET") {
      const counts = await kv.get(key, "json") || {};
      const top = Object.values(counts).sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0] || null;
      return json({ week, top });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    const videoId = String(body.videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return json({ error: "Invalid YouTube video ID." }, 400);
    const title = String(body.title || "YouTube video").trim().slice(0, MAX_TITLE) || "YouTube video";
    const artist = String(body.artist || "").trim().slice(0, MAX_ARTIST);
    const counts = await kv.get(key, "json") || {};
    const existing = counts[videoId] || { videoId, title, artist, count: 0 };
    existing.title = title;
    if (artist) existing.artist = artist;
    existing.count = Number(existing.count || 0) + 1;
    existing.lastListened = Date.now();
    counts[videoId] = existing;
    const trimmed = Object.fromEntries(Object.entries(counts).sort((a, b) => Number(b[1]?.count || 0) - Number(a[1]?.count || 0)).slice(0, 500));
    await kv.put(key, JSON.stringify(trimmed));
    return json({ ok: true, week, top: Object.values(trimmed).sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0] || existing });
  } catch (error) {
    console.error("Narwhal weekly listening error:", error);
    return json({ error: `Weekly listening backend error: ${error?.message || "unknown error"}` }, 500);
  }
}

async function handleAdminCommand(request, env) {
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const kv = env.GLOBAL_CHAT;
    if (!kv) return json({ error: "Admin commands are not configured: GLOBAL_CHAT KV binding is missing." }, 500);
    if (request.method === "GET") {
      const command = await kv.get(ADMIN_COMMAND_KEY, "json");
      return json({ command: command || null });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    if (!adminAuthorized(body, env)) return json({ error: "Unauthorized." }, 401);
    const command = String(body.command || "").trim();
    if (!ALLOWED_ADMIN_COMMANDS.has(command)) return json({ error: "Unknown admin command." }, 400);
    const text = String(body.text || "").trim().slice(0, MAX_COMMAND_TEXT);
    const transient = !new Set(["lock-music", "disable-games", "unlock-all"]).has(command);
    const record = {
      id: crypto.randomUUID(),
      command,
      text,
      time: Date.now(),
      transient
    };
    await kv.put(ADMIN_COMMAND_KEY, JSON.stringify(record));
    return json({ ok: true, command: record });
  } catch (error) {
    console.error("Narwhal admin command error:", error);
    return json({ error: `Admin command backend error: ${error?.message || "unknown error"}` }, 500);
  }
}

async function handleRequests(request, env) {
  if (request.method === "OPTIONS") return json({}, 204);
  if (!["GET", "POST", "DELETE"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
  try {
    const kv = env.GLOBAL_CHAT;
    if (!kv) return json({ error: "Requests are not configured: GLOBAL_CHAT KV binding is missing." }, 500);
    if (request.method === "GET") {
      const password = new URL(request.url).searchParams.get("password") || "";
      if (!adminAuthorized(password, env)) return json({ error: "Unauthorized." }, 401);
      const requests = await kv.get(REQUESTS_KEY, "json") || [];
      return json({ requests: Array.isArray(requests) ? requests : [] });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    if (request.method === "DELETE") {
      if (!adminAuthorized(body, env)) return json({ error: "Unauthorized." }, 401);
      const id = String(body.id || "");
      const requests = await kv.get(REQUESTS_KEY, "json") || [];
      const next = Array.isArray(requests) ? requests.filter(item => item?.id !== id) : [];
      await kv.put(REQUESTS_KEY, JSON.stringify(next));
      return json({ ok: true });
    }
    const allowedTypes = new Set(["Song", "Artist", "Game", "Other"]);
    const type = allowedTypes.has(String(body.type)) ? String(body.type) : "Other";
    const text = String(body.text || "").trim().slice(0, MAX_MESSAGE);
    const name = String(body.name || "").trim().slice(0, MAX_NAME);
    if (!text) return json({ error: "Request cannot be empty." }, 400);
    const requests = await kv.get(REQUESTS_KEY, "json") || [];
    const requestItem = { id: crypto.randomUUID(), type, text, name, time: Date.now() };
    const next = [requestItem, ...(Array.isArray(requests) ? requests : [])].slice(0, MAX_REQUESTS);
    await kv.put(REQUESTS_KEY, JSON.stringify(next));
    return json({ ok: true, request: requestItem });
  } catch (error) {
    console.error("Narwhal requests error:", error);
    return json({ error: `Requests backend error: ${error?.message || "unknown error"}` }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/global-chat" || url.pathname === "/api/global-chat/") return handleGlobalChat(request, env);
    if (url.pathname === "/api/weekly-listens" || url.pathname === "/api/weekly-listens/") return handleWeeklyListens(request, env);
    if (url.pathname === "/api/requests" || url.pathname === "/api/requests/") return handleRequests(request, env);
    if (url.pathname === "/api/admin-command" || url.pathname === "/api/admin-command/") return handleAdminCommand(request, env);
    return env.ASSETS.fetch(request);
  }
};
