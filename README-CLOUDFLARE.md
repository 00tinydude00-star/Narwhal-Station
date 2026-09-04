# Narwhal Station — Cloudflare Pages

This project is prepared for Cloudflare Pages Git integration.

## Cloudflare setup

1. Connect this GitHub repository to Cloudflare Pages.
2. Production branch: `main`
3. Build command: `exit 0`
4. Build output directory: `.`
5. Create a Cloudflare Workers KV namespace named anything you like (for example `narwhal-global-chat`).
6. In the Pages project, go to **Settings → Bindings → Add → KV namespace**.
7. Set the binding variable name to `GLOBAL_CHAT` and select the KV namespace.
8. Add an environment variable/secret named `ADMIN_CHAT_PASSWORD` with the value of the admin password.
9. Redeploy the project after adding the binding/secret.

The Global Chat endpoint is `/api/global-chat` and is implemented by `functions/api/global-chat.js`.
