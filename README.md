# Amy Nakamoto: Open Cooperation Experiment

An open-network behavioral game for repeated cooperation and defection decisions on TON.

The repository currently implements the native-coin round core. It intentionally does not
pretend that Jeton, GRM, or USDT can be handled as TON coins: those stake types need explicit
jetton-wallet adapters and settlement tests before they are enabled on testnet.

## Requirements

- Node.js 20 or newer
- npm

## Commands

```bash
npm install
npm run build
npm test
npm run deploy:counter
npm run deploy:round
npm run format:check
```

`npm run build` compiles every contract in `compilables/` and writes artifacts to `build/`.

## Testnet workflow

1. Copy `.env.example` to `.env` and fill in the testnet RPC + API key values.
2. Compile and test locally:

```bash
npm test
npm run build
```

3. Deploy a sample counter or the round contract to TON testnet:

```bash
npm run deploy:counter
npm run deploy:round
```

The round deploy script creates a fixed-duration experiment round with a native TON settlement boundary. The current implementation intentionally does not include production-grade Jeton, GRM, or USDT custody yet; those should be implemented behind explicit wallet-transfer adapters before they are used in a live experiment.

## Stake policy boundary

The repo now defines an explicit stake abstraction in `wrappers/stake.ts` so that the round can be configured as:

- `free` - onboarding / no-value mode
- `jeton` - adapter-backed jetton flow
- `grm` - adapter-backed ecosystem token flow
- `usdt` - adapter-backed stablecoin flow

This avoids confusing non-TON assets with TON coin settlement. The round contract stores the round’s stake type and settlement mode, but the actual token transfer and claim logic remain outside the core smart-contract runtime until a dedicated wallet adapter is defined.

The following environment variables can be used when deploying to testnet:

```bash
ROUND_STAKE_TYPE=free
ROUND_STAKE_AMOUNT=0
ROUND_DURATION=3600
ROUND_REVEAL_DURATION=600
ROUND_ID=1
ROUND_STARTS_AT=1710000000
```

## Layout

- `contracts/`: Tolk source files
- `compilables/`: Blueprint compiler configurations
- `wrappers/`: TypeScript contract wrappers
- `tests/`: Sandbox tests
- `scripts/`: Blueprint network scripts

## Protocol core

`OpenCooperationRound` is a fixed-configuration round with three on-chain phases:

1. Commit: a participant submits `hash(action, salt)` keyed by their address.
2. Reveal: after the decision deadline, the participant submits the action and salt. The
	 contract verifies the hash and records aggregate cooperation and defection counts.
3. Resolve: after the reveal window, anyone can close the round deterministically.

The round durations are data, so the same contract supports hourly, daily, and weekly rounds.
The round identity, duration, reveal window, stake type, stake amount, and start time are part
of initialization and can be independently reproduced from the deployed state.

The current core records the observation data and phase transitions. Payout claims, recurring
round creation, and non-TON stake custody are deliberately separate follow-up boundaries:

- Native TON settlement needs a claim ledger and deterministic pool-split policy.
- Jeton, GRM, and USDT need configured jetton master addresses, wallet callbacks, and refund
	handling for failed or expired transfers.
- A round factory or coordinator can create the next round without making the round rules
	mutable.

Before testnet, these boundaries should be completed with adversarial tests for replay,
duplicate commits, invalid reveals, late messages, missing reveals, insufficient gas, and
jetton transfer notification spoofing.

To deploy the sample contract to a configured TON network, run:

```bash
npx blueprint run deployCounter
```
