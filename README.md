# Vault Manager

A self-hosted web UI for moving items between Vaultwarden / Bitwarden vaults and collections.
Wraps the `bw` CLI with a clean browser interface. Authenticate once — the server holds the session.

## Prerequisites

- Your Vaultwarden server is running
- You have a **Bitwarden API key** (Profile → Security → API Key in your Vaultwarden web vault)

## Environment variables

| Variable | Description |
|---|---|
| `BW_SERVER_URL` | Your Vaultwarden URL e.g. `https://vault.yourdomain.com` |
| `BW_CLIENTID` | API key client ID from your Vaultwarden profile |
| `BW_CLIENTSECRET` | API key client secret |
| `SESSION_SECRET` | Random string for signing browser session cookies |

## Deploy with Dokploy

1. Push this folder to a Git repo.
2. In Dokploy → **New → Compose** → point at your repo.
3. Set the four environment variables in the Dokploy env settings.
4. Set a domain in Dokploy (Traefik handles HTTPS automatically).
5. Deploy. On first start the container logs in to Vaultwarden via API key.
6. Open the domain in your browser, enter your master password to unlock, and start moving items.

## Local dev

```bash
npm install

# Terminal 1 — backend
node server.js

# Terminal 2 — frontend (proxies /api to :3000)
npm run dev:client
```

## How it works

- `start.sh` configures the `bw` CLI server URL and logs in via API key on container start.
- Every request passes the master-password-derived `BW_SESSION` as an env var to `bw` subprocess calls.
- The browser holds an httpOnly session cookie that maps to the server-side `BW_SESSION`.
- Re-authentication is only needed after a server restart or 8-hour session expiry.

## Move methods

- **Collection change (fast):** item stays in the same org, only its `collectionIds` changes. Uses `bw edit item-collections` — instant, no re-encryption.
- **Clone + delete (slow):** item crosses a vault ownership boundary (personal ↔ org, or org A → org B). The item is decrypted, re-encrypted under the destination key, then the original is deleted. The original is only deleted after a successful copy — no data loss on failure.
