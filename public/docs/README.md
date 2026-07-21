# PonsDrop

**Launch tokens on Robinhood Chain through pons, and route the creator fees at launch.**

Every pons token pays its creator 70% of all trading fees on its pool, forever. By default those fees go to the deployer's wallet. PonsDrop adds one decision to the launch form: where should that stream go?

- **Keep it**: fees to your own wallet, exactly like launching on pons directly.
- **Drop to holders**: fees pool in a vault and rain on your holders in configurable rounds.
- **Split fees**: fees split automatically between up to 20 wallets.
- **Buyback and burn**: fees market-buy your token and burn it.

The launch itself is a single transaction your wallet signs on the pons factory. PonsDrop never holds your funds, your token, or your pool.

## Quick facts

| | |
| --- | --- |
| Chain | Robinhood Chain (4663) |
| Launch fee | 0.0005 ETH |
| Supply | 1,000,000,000, fixed |
| Creator fee share | 70% of trading fees |
| Pool | Uniswap V3, 1% fee, locked forever |
| Graduation | 4.2 ETH paired principal |

## Where to go next

- [Launch guide](/docs/launch-guide.md): step by step, from empty form to live token.
- [Fee modes](/docs/fee-modes.md): what each route does, in detail.
- [Trust model](/docs/trust-model.md): what is on-chain, what our bot does, what you are trusting.

> PonsDrop is an unofficial layer on pons and is not affiliated with Pons Labs. Tokens are volatile; transactions may be irreversible. Nothing in these docs is financial advice.
