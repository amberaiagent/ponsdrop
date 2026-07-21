# Drop to holders

The flagship mode, inherited from trench: hold the token, get paid.

## How a round works

1. The bot claims accrued creator fees from the locker (`collectFees`), unwraps WETH into ETH.
2. When a round's trigger fires, it snapshots holders ranked by balance from the Blockscout API.
3. The round's % of the vault is split **evenly** across everyone in your chosen range and sent as plain ETH transfers. Token-side fees are split the same way.
4. The round, its amounts and its transaction count are recorded on the token page.

## Triggers

**Market cap milestones.** You set the first round's cap and a ladder:

- *Multiply ×N*: rounds at $50k, $100k, $200k, $400k... (with ×2)
- *Step +$X*: rounds at $50k, $100k, $150k... (with +$50k)

Market cap is read from the pool's spot price times the fixed 1B supply, in USD.

**Timer.** Rounds fire every N hours after launch, market cap ignored. Good for steady drip campaigns.

## Percentages

Each round distributes its % of **whatever the vault holds at that moment**. Fees keep accruing between rounds, so with "50% per round" the vault tapers but never empties: 50%, then 50% of what accumulated since, and so on.

After the last configured round, the vault keeps flushing **100%** of new fees at the same cadence: late fees still reach holders, forever.

## Presets

| Preset | Meaning |
| --- | --- |
| Halving | 10 rounds, 50% each, cap ×2 |
| Full send | 10 rounds, 100% at every milestone, cap ×2 |
| Drip | 14 rounds, 20% every 12 hours |

## Who never counts as a holder

The pool, the locker, the factory, the vault itself, your deployer wallet, the zero and dead addresses. Everyone else in the range gets an equal share, whales and minnows alike: an even split across ranks was trench's design and it stays.

## Safety rails

- If a round fires but the vault is dust (below ~0.001 ETH), the bot waits instead of spraying crumbs.
- If Blockscout lags, the round waits for the next bot cycle rather than paying a wrong list.
- Wick-triggered rounds are possible by design: if the cap touches the target, the round is due. Trench worked the same way.
