# Contracts and network

Everything robindrop talks to on-chain, all verified on Blockscout.

## Network

| | |
| --- | --- |
| Chain | Robinhood Chain |
| Chain ID | 4663 |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com) |
| Currency | ETH |

## pons protocol

| Contract | Address | Notes |
| --- | --- | --- |
| Factory (active) | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` | `PonsLaunchFactory`, from block 8991118 |
| Locker (active) | `0x736D76699C26D0d966744cAe304C000d471f7F35` | `PonsLaunchLocker`, holds pool NFTs, pays fees |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | pair token for every launch |
| Swap router | `0xCaf681a66D020601342297493863E78C959E5cb2` | Uniswap V3, used for buybacks |

Launch config 0 (the only one, used for all launches): WETH pair, 1B supply, graduation threshold 4.2 ETH, pool fee 1%, max wallet 5%, max tx 5.5%, 2 restriction blocks. Fee split on the active locker: creator 70 / protocol 30.

## Functions robindrop uses

**Factory**

- `launchToken(params, launchConfigId, dexId, salt)`: signed by your wallet at launch. `params.feeWallet` is where fee routing happens.
- `getLaunchedToken(token)`, `graduationStatus(token)`, `launchFee()`: reads for the token pages.

**Locker**

- `collectFees(token)`: called by the vault to claim accrued creator fees. Returns the WETH and token amounts.
- `feeRedirects(token)`: if set, overrides the fee recipient.

**Events**

- `TokenLaunched(token, deployer, dexFactory, pairToken, pool, ...)`: indexed from block 8991118 for the Explore page.

## ABIs

Full verified ABIs ship in the repository under `config/factory-abi.json` and `config/locker-abi.json`, pulled straight from Blockscout's verified source.
