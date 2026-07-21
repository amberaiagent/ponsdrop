# Self-hosting

robindrop is a small Node app plus a bot process. No build step, no database server required to start.

## Requirements

- Node 20+
- An always-on machine for the bot (a $5 VPS is plenty)
- Optionally Docker

## Setup

```bash
git clone https://github.com/amberaiagent/robindrop.git
cd robindrop
cp .env.example .env
npm install
```

Fill `.env`:

```bash
# generate the vault encryption key
openssl rand -base64 32     # -> VAULT_ENCRYPTION_KEY
# pick a long random admin token -> ADMIN_TOKEN
```

Run:

```bash
npm start        # web + indexer on :3000
npm run bot      # distribution bot, DRY_RUN by default
```

On Windows PowerShell, if `npm` is blocked by the execution policy, use `npm.cmd` or run `node src/server.js` and `node bot/bot.js` directly.

## Docker

```bash
docker compose up -d
```

Runs the web service and the bot with `./data` mounted into both.

## Going live checklist

1. `VAULT_ENCRYPTION_KEY` and `ADMIN_TOKEN` set on the server; `.env` is never committed.
2. Launch a real token and watch the bot logs with `DRY_RUN=true` for at least one round trigger.
3. Flip `DRY_RUN=false` and restart the bot.
4. Back up `data/`: it holds the encrypted vault keys. Losing it strands unclaimed vault fees.
5. Point a domain at the web service, put it behind HTTPS.

## Storage

Launches and vault keys live in JSON files under `data/`. The store module is deliberately shaped like a repository layer, so swapping in Postgres later is a contained change: implement the same functions in `src/store.js` against a database and nothing else moves.
