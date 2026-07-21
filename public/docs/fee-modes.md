# Fee modes

Creator fees on pons are 70% of all trading fees on the token's pool. The other 30% goes to the pons protocol. robindrop routes the 70%.

## Keep it

The default. `feeWallet` is your connected wallet, fees accrue in the locker and you claim them on pons whenever you like. robindrop is not involved at all: this is identical to launching on pons directly.

## Drop to holders

The trench mode. Fees accumulate in a robindrop vault and get airdropped to your holders in rounds. Fully configurable:

- **Holder range**: ranks #1 to #1000 by balance, e.g. "#1 to #200" or "#50 to #500".
- **Rounds**: 1 to 30.
- **% per round**: the share of the vault distributed when a round fires.
- **Triggers**: market cap milestones on a ladder (×2, ×3, +$50k steps...) or a plain timer (every N hours).

Full detail on triggers, exclusions and edge cases: [Drop to holders](/docs/drop-to-holders.md).

## Split fees

Up to 20 wallets, each with a percentage, summing to exactly 100. The bot forwards both the ETH side and the token side of collected fees by those shares whenever the vault holds enough to be worth the gas. Good for splitting with a co-dev, an artist, a KOL deal, or a treasury.

## Buyback and burn

Two flows, both automatic:

1. Token-side fees go straight to `0x000...dEaD`.
2. ETH-side fees (WETH) are swapped into your token on your own pool via the Uniswap V3 router, and the output goes to `0x000...dEaD` too.

Net effect: constant buy pressure funded by trading, and a supply that only shrinks. Runs continuously, no schedule.

> One mode per token, chosen at launch. The locker does expose `setFeeRedirect`, so a later version may allow the fee recipient to re-point the stream; today robindrop keeps it simple and immutable.
