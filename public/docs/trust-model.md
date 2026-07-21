# Trust model

Stated plainly, because "non-custodial" gets thrown around too loosely.

## What is non-custodial

- **The launch.** Your wallet signs `launchToken()` on the pons factory. The launch fee and dev buy go to the factory, not to us.
- **Your token and pool.** Supply is fixed by the factory, the pool position is locked in the pons locker forever. Nobody, including PonsDrop, can pull liquidity.
- **"Keep it" mode.** Fees go to your wallet. PonsDrop never appears in the flow.

## What is custodial

**The fee stream in managed modes.** When you pick holder drops, a split, or burn, the `feeWallet` is a PonsDrop vault:

- The vault's private key is generated server-side and stored encrypted with AES-256-GCM. The encryption key lives only in server environment variables, never in the repository or the database backups.
- Only creator fees ever touch this wallet. Holder funds, trader funds and your own wallet are never involved.
- Every movement out of the vault is a public transaction you can audit on Blockscout against the promised schedule.

This is a deliberate trade: a server-held key is what lets a bot pay 200 holders every round without anyone signing 200 prompts. If that trade is not for you, pick **Keep it**: it costs you nothing and PonsDrop stays out of the loop.

## What the bot can and cannot do

Can: claim creator fees from the locker to the vault, and send them out per your launch config.

Cannot: touch your pool, mint or burn supply beyond buybacks it pays for, change your fee mode, or spend anything that is not a creator fee.

## Known limitations

- A PonsDrop server outage pauses distributions; fees keep accruing in the locker and vault, nothing is lost.
- The buyback swap runs against your own pool without an oracle price floor; on an illiquid pool a single buyback moves the price. That is arguably the point of the mode.
- Market cap reads use the pool spot price and a public ETH/USD feed; extreme wicks can fire a round early.
