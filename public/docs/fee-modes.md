# Fee modes

Creator fees on pons are 70% of all trading fees on the token's pool. The other 30% goes to the pons protocol. PonsDrop routes the 70%.

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

1. Token-side fees are sold into your own pool for WETH.
2. Everything is unwrapped to ETH and sent to the charity's address whenever the vault holds enough to be worth the gas.
3. Each donation appears in the token's payout history with the charity's name and the transaction.

Built-in options ship with addresses copied from each charity's **own official donation page** (sources are linked in the launch form):

| Charity | Verification |
| --- | --- |
| St. Jude Children's Research Hospital | ENS `nft.stjude.eth` resolves to this address on-chain; published at [stjude.org/donate/crypto](https://www.stjude.org/donate/crypto.html) |
| GiveWell | Static address on [givewell.org's donation page](https://www.givewell.org/about/donate/cryptocurrency) |
| Internet Archive | Static address on [archive.org/donate/cryptocurrency](https://archive.org/donate/cryptocurrency) |
| Electronic Frontier Foundation | Static address on [eff.org/pages/cryptocurrency-donations](https://www.eff.org/pages/cryptocurrency-donations) |
| Freedom of the Press Foundation | Static address on [freedom.press/donate/cryptocurrency](https://freedom.press/donate/cryptocurrency/) |

Every built-in address is additionally checked to be a plain wallet (EOA), not a contract, so it is valid on any EVM network including Robinhood Chain. Donations are sent on Robinhood Chain: the charity's key controls them there, though the charity may need to add the network to see them.

You can also paste any charity's address yourself. Note that some large charities (Shriners, Save the Children, GiveDirectly) accept crypto only through processors like The Giving Block, DonateStock or Endaoment, which generate a fresh address per donation, so they have no static address to hardcode. If you paste a custom address, make sure it is a plain wallet and not an exchange deposit address or a contract: those can swallow cross-chain funds forever. PonsDrop cannot verify a custom address belongs to who you think it does.

## Buyback and burn

Two flows, both automatic:

1. Token-side fees go straight to `0x000...dEaD`.
2. ETH-side fees (WETH) are swapped into your token on your own pool via the Uniswap V3 router, and the output goes to `0x000...dEaD` too.

Net effect: constant buy pressure funded by trading, and a supply that only shrinks. Runs continuously, no schedule.

> One mode per token, chosen at launch. The locker does expose `setFeeRedirect`, so a later version may allow the fee recipient to re-point the stream; today PonsDrop keeps it simple and immutable.
