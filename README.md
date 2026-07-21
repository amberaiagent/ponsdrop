# robindrop

Launch fixed-supply tokens on Robinhood Chain through pons, and route the creator
fees wherever you want at launch: your own wallet, round drops to your holders,
a team split, or a buyback and burn.

Rob the dev. Feed the holders.

## What it does

- **Launch** (`/launch`): pons-style create form, injected wallet, signs
  `launchToken()` on the pons factory directly. Fee routing is picked in the form.
- **Fee modes:**
  - **Keep it**: fees to your connected wallet, robindrop untouched.
  - **Drop to holders** (trench mode): fees pool in a vault and are airdropped to
    holders `#N` to `#M` (up to `#1000`) in 1 to 30 rounds. Rounds trigger on a
    market cap ladder (`x2`/`x3`/`+$X` from a start cap) or on a timer. Each round
    sends its % of the vault, split evenly. After the schedule the vault flushes
    100% at the same cadence.
  - **Team split**: up to 20 wallets by percent, paid automatically.
  - **Buyback and burn**: fees market-buy the token on its own pool and burn it.
- **Explore** (`/explore`): all factory launches from the indexer.
- **Token page** (`/token/<address>`): cap, graduation progress, vault balances,
  schedule and payout history.
- **Admin** (`/admin`): pause, force a round, inspect state. Guarded by `ADMIN_TOKEN`.
- **Bot** (`bot/`): claims fees from the locker (`collectFees`), snapshots holders
  via Blockscout, executes the chosen distribution. `DRY_RUN=true` by default.

## Stack

Node/Express (ESM) + static frontend, no build step. `viem` on the server and via
CDN in the browser. JSON file storage under `data/` (gitignored), shaped for an
easy later swap to Postgres.

## Network

| Thing | Value |
| --- | --- |
| Chain | Robinhood Chain (4663) |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |
| Factory | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` (block 8991118) |
| Locker | `0x736D76699C26D0d966744cAe304C000d471f7F35` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| Swap router | `0xCaf681a66D020601342297493863E78C959E5cb2` (fee 10000) |
| Launch fee | 0.0005 ETH, supply 1B fixed, graduation 4.2 ETH |
| Creator fees | 70% of trading fees (locker `protocolFeeShare` = 30) |

## Setup

```bash
cp .env.example .env
# generate the vault key and put it in .env:
openssl rand -base64 32   # -> VAULT_ENCRYPTION_KEY
# set ADMIN_TOKEN to something long and random
npm install
npm start        # web + indexer on http://localhost:3000
npm run bot      # distribution bot (DRY_RUN by default)
```

Docker: `docker compose up -d` runs web and bot with `./data` mounted.

## Trust model, stated plainly

Launching is non-custodial: your wallet signs the factory call, funds go to the
factory. Managed fee modes are custodial for the fee stream only: the vault key
is generated server-side and stored AES-256-GCM encrypted; the encryption key
lives only in `.env`. Holders' and traders' funds are never touched. If you do
not want a managed vault, pick "Keep it".

## Going live checklist

1. `VAULT_ENCRYPTION_KEY` and `ADMIN_TOKEN` set on the server, `.env` never committed.
2. Bot proven on a real token with `DRY_RUN=true` (watch the logs).
3. Flip `DRY_RUN=false`.
4. `data/` backed up: it holds encrypted vault keys. Lose it and unclaimed vault fees are stuck.

## Disclaimer

Unofficial layer on pons. Not affiliated with Pons Labs. Tokens are volatile;
transactions may be irreversible.
