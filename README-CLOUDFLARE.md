# Narwhal Station — Cloudflare Worker

This version is set up for **Cloudflare Workers + Static Assets**.

## What is fixed
- The website is served by the Worker.
- `/api/global-chat` is a real Worker route, so it no longer returns 404.
- Global Chat uses the `GLOBAL_CHAT` KV binding for shared messages.
- Admin-only sending uses the `ADMIN_CHAT_PASSWORD` Worker secret.
- The Music Management page includes the approved artist list and an artist/song search box.

## Cloudflare setup
In the Worker dashboard:

1. Open **Settings → Bindings** and add a **KV namespace** binding named `GLOBAL_CHAT`.
2. Choose the KV namespace that should store the latest chat message.
3. Add a secret named `ADMIN_CHAT_PASSWORD` with your admin chat password.
4. Redeploy the Worker after saving the settings.

The frontend calls `/api/global-chat`, so no separate Pages Function is needed.
