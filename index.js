const STORE_KEY = "latest";
const MAX_NAME = 40;
const MAX_MESSAGE = 500;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    }
  });
}

async function handleGlobalChat(request, env) {
  if (request.method === "OPTIONS") return json({}, 204);
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const kv = env.GLOBAL_CHAT;
    if (!kv) {
      return json({ error: "Global Chat is not configured: GLOBAL_CHAT KV binding is missing." }, 500);
    }

    if (request.method === "GET") {
      const message = await kv.get(STORE_KEY, "json");
      return json({ message: message || null });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request." }, 400);
    }

    const expectedPassword = env.ADMIN_CHAT_PASSWORD;
    if (!expectedPassword) {
      return json({ error: "Global Chat is not configured: ADMIN_CHAT_PASSWORD secret is missing." }, 500);
    }
    if (typeof body.password !== "string" || body.password !== expectedPassword) {
      return json({ error: "Unauthorized." }, 401);
    }

    const name = String(body.name || "Administrator").trim().slice(0, MAX_NAME) || "Administrator";
    const text = String(body.text || "").trim().slice(0, MAX_MESSAGE);
    if (!text) return json({ error: "Message cannot be empty." }, 400);

    const message = {
      id: crypto.randomUUID(),
      name,
      text,
      time: Date.now()
    };

    await kv.put(STORE_KEY, JSON.stringify(message));
    return json({ ok: true, message });
  } catch (error) {
    console.error("Narwhal Global Chat error:", error);
    return json({ error: `Global Chat backend error: ${error?.message || "unknown error"}` }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Cloudflare Worker API route used by Narwhal Station Global Chat.
    if (url.pathname === "/api/global-chat" || url.pathname === "/api/global-chat/") {
      return handleGlobalChat(request, env);
    }

    // Serve the rest of the website from Cloudflare's static asset service.
    return env.ASSETS.fetch(request);
  }
};
