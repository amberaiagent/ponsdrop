# Fee modes

Creator fees on pons are 70% of all trading fees on the token's pool. The other 30% goes to the pons protocol. PonsDrop routes the 70%.

> PonsDrop only ever distributes the **ETH-denominated** creator fees. Fees also accrue in the token itself, and those stay untouched in the vault: the bot never sells, transfers or burns your launch supply, so a managed launch never dumps on its own pool.

## Keep it

The default. `feeWallet` is your connected wallet, fees accrue in the locker and you claim them on pons whenever you like. PonsDrop is not involved at all: this is identical to launching on pons directly.

## Drop to holders

The trench mode. Fees accumulate in a PonsDrop vault and get airdropped to your holders in rounds. Fully configurable:

- **Holder range**: ranks #1 to #1000 by balance, e.g. "#1 to #200" or "#50 to #500".
- **Rounds**: 1 to 30.
- **% per round**: the share of the vault distributed when a round fires.
- **Triggers**: market cap milestones on a ladder (×2, ×3, +$50k steps...) or a plain timer (every N hours).

Full detail on triggers, exclusions and edge cases: [Drop to holders](drop-to-holders.md).

## Split fees

Up to 20 wallets, each with a percentage, summing to exactly 100. The bot forwards both the ETH side and the token side of collected fees by those shares whenever the vault holds enough to be worth the gas. Good for splitting with a co-dev, an artist, a KOL deal, or a treasury.

## Donate to charity

Creator fees become public, on-chain donations:

1. The ETH-side fees are unwrapped and sent to the charity's address whenever the vault holds enough to be worth the gas.
2. Each donation appears in the token's payout history with the charity's name and the transaction.

Token-side fees are not sold for the donation; they rest in the vault so the charity token is never dumped into its own pool.

Built-in options ship with addresses copied from each charity's **own official donation page** (sources are linked in the launch form):

| Charity | Verification |
| --- | --- |
| St. Jude Children's Research Hospital | ENS `nft.stjude.eth` resolves to this address on-chain; published at [stjude.org/donate/crypto](https://www.stjude.org/donate/crypto.html) |
| GiveWell | Static address on [givewell.org's donation page](https://www.givewell.org/about/donate/cryptocurrency) |
| Internet Archive | Static address on [archive.org/donate/cryptocurrency](https://archive.org/donate/cryptocurrency) |
| Electronic Frontier Foundation | Static address on [eff.org/pages/cryptocurrency-donations](https://www.eff.org/pages/cryptocurrency-donations) |
| Freedom of the Press Foundation | Static address on [freedom.press/donate/cryptocurrency](https://freedom.press/donate/cryptocurrency/) |

Every built-in address is additionally checked to be a plain wallet (EOA), not a contract, so it is valid on any EVM network including Robinhood Chain. Donations are sent on Robinhood Chain: the charity's key controls them there, though the charity may need to add the network to see them.

The list is curated on purpose: only charities with a static, officially published wallet make it in. Some large charities (Shriners, Save the Children, GiveDirectly) accept crypto only through processors like The Giving Block, DonateStock or Endaoment, which generate a fresh address per donation; there is no safe address to hardcode for them, so they are not offered. Want another charity listed? It needs a static address published on the charity's own site: open an issue or PR on GitHub with the source link.

## Buyback and burn

Two flows, both automatic:

1. Token-side fees go straight to `0x000...dEaD`.
2. ETH-side fees (WETH) are swapped into your token on your own pool via the Uniswap V3 router, and the output goes to `0x000...dEaD` too.

Net effect: constant buy pressure funded by trading, and a supply that only shrinks. Runs continuously, no schedule.

> One mode per token, chosen at launch. The locker does expose `setFeeRedirect`, so a later version may allow the fee recipient to re-point the stream; today PonsDrop keeps it simple and immutable.
