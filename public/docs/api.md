# HTTP API

The same API the site runs on. All responses are JSON. No authentication except the admin routes.

## Public

### `GET /api/config`

Chain info, contract addresses, live launch fee, drop defaults and limits.

### `GET /api/launches`

Every launch known to the indexer, newest first. robindrop launches carry their `feeMode` and config; foreign launches show as `external`.

### `GET /api/token/:address`

Full detail for one token:

```json
{
  "launch":  { "id": "...", "feeMode": "holders", "dropConfig": {}, "distributions": [] },
  "onchain": { "mcapUsd": 0, "graduated": false, "pairedPrincipalEth": "0" },
  "vault":   { "address": "0x...", "eth": "0", "weth": "0", "token": "0" },
  "schedule": [ { "round": 1, "capUsd": 50000, "pct": 50 } ],
  "nextRound": { "round": 1, "capUsd": 50000, "pct": 50 }
}
```

### `POST /api/launch/prepare`

Called by the launch form before the transaction. Body: `feeMode`, token metadata, and `dropConfig` or `splitConfig` for managed modes. Returns `draftId` and the `feeWallet` to put in `launchToken()`.

### `POST /api/launch/confirm`

Reports the transaction hash (and token address once known) so the indexer can link the launch to its draft.

### `POST /api/schedule/preview`

Send a drop config, get back the normalized config and the computed round schedule. Powers the form infographic.

## Admin (`x-admin-token` header)

- `POST /api/admin/login`: verify a token.
- `GET /api/admin/launches`: full registry, including drafts.
- `PATCH /api/admin/launches/:id`: pause/resume (`paused`), trigger a round now (`forceRound`), or record a distribution (used by the bot).
