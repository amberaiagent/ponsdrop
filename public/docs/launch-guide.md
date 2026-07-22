# Launch guide

From empty form to live token in five steps.

## 1. Get a wallet on Robinhood Chain

Any injected wallet works: MetaMask, Rabby, Rainbow. Open [the launch page](/launch ':ignore') and hit **Connect wallet**: if Robinhood Chain (4663) is missing, the site offers to add it with one click.

You need enough ETH for the 0.0005 launch fee, gas, and any dev buy you want.

## 2. Fill in the token

Name, ticker, logo URL, description, socials. The logo is a plain link: `ipfs://` links from the pons uploader work best, a regular `https://` image link works too.

**Dev buy** is optional: extra ETH sent with the launch that buys your token in the same transaction. The max wallet at launch is 5% of supply, so there is a natural cap.

## 3. Pick the fee route

This is the PonsDrop part. Five options, one choice, set forever at launch:

| Mode | Fees go to | Configuration |
| --- | --- | --- |
| Keep it | your connected wallet | none |
| Drop to holders | your holders, in rounds | range, rounds, %, triggers |
| Split fees | wallets you list | addresses + percentages |
| Buyback and burn | the token itself, then `0x...dEaD` | none |
| Donate to charity | a charity, as ETH | pick built-in or paste an address |

See [Fee modes](fee-modes.md) for the details of each.

## 4. Sign the transaction(s)

Hit **Launch token**. Your wallet signs `launchToken()` on the factory with **your own wallet** as `feeWallet`:

```
launchToken(
  { name, symbol, logo, description, socials, feeWallet: you },
  launchConfigId: 0,
  dexId: 0,
  salt
)
```

Value = 0.0005 ETH launch fee + your dev buy. Because `feeWallet` is your wallet, **the dev buy lands with you**, exactly like a normal pons launch.

For managed modes there is one more signature: `setFeeRedirect(token, vault)` on the locker, which routes future trading fees to the PonsDrop vault. Only the deployer can call it, so you sign it. From that point fees flow to the vault while your dev buy stays yours. "Keep it" mode skips this step entirely.

## 5. Done

The site waits for the receipt, picks the token address out of the `TokenLaunched` event, and sends you to the token page: market cap, graduation progress, vault balance, schedule, payout history. Trading is live from block one.
