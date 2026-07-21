# Deploy PonsDrop on a VPS

Target: ExtraVM (or any) VPS, Ubuntu 24.04 LTS, Docker. Two containers:
`web` (site + indexer, port 80) and `bot` (distributions), sharing `./data`.

## 1. One-time server bootstrap

SSH in as root and paste:

```bash
apt update && apt install -y git curl nano
curl -fsSL https://get.docker.com | sh

git clone https://github.com/amberaiagent/ponsdrop.git
cd ponsdrop
cp .env.example .env

# generate the vault encryption key and an admin token, put both into .env
openssl rand -base64 32     # -> VAULT_ENCRYPTION_KEY
openssl rand -hex 16        # -> ADMIN_TOKEN
nano .env                   # paste both values, leave DRY_RUN=true

docker compose up -d --build
docker compose ps
```

The site is now at `http://<VPS_IP>` and the admin at `http://<VPS_IP>/admin`.
The indexer starts backfilling launches immediately (takes ~30 min first run).

## 2. Domain via Cloudflare (when ready)

1. Add the domain to Cloudflare, point registrar nameservers at it.
2. DNS: `A @ <VPS_IP>` and `A www <VPS_IP>`, both **Proxied**.
3. SSL/TLS mode: **Flexible** works out of the box (Cloudflare terminates HTTPS,
   talks HTTP to port 80). For **Full (strict)** later: create an Origin
   Certificate and put nginx or Caddy in front, same flow as the trench deploy.
4. Edge Certificates: **Always Use HTTPS = On**.

## 3. Going live checklist

1. Launch a real test token through the site, watch `docker compose logs -f bot`
   with `DRY_RUN=true`: you want to see `collectFees` succeed and a round trigger.
2. Flip `DRY_RUN=false` in `.env`, then `docker compose up -d` (recreates bot).
3. Back up `data/` somewhere off the box: it holds the encrypted vault keys.
   Losing it strands unclaimed vault fees. `tar czf - data | ...` on a cron is fine.
4. Never commit or share `.env`.

## Updating

```bash
cd ponsdrop
git pull
docker compose up -d --build
```

## Useful commands

```bash
docker compose logs -f bot     # live bot activity
docker compose logs -f web     # indexer + API
docker compose restart bot     # after .env changes affecting only the bot
docker compose down            # stop everything (data/ persists)
```

## Firewall (recommended)

```bash
apt install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

With Cloudflare proxied DNS you can tighten 80/443 to Cloudflare IP ranges only:
https://www.cloudflare.com/ips/
