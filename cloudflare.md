# Cloudflare deployment notes

This repo is ready for a Cloudflare Pages/Workers deployment pattern using a non-interactive API token flow instead of `wrangler login`:

- Static frontend: built with Vite and served from `dist/`
- Runtime API layer: `workers/index.ts` for `/api/*` endpoints
- Contract configuration: the deployed TON testnet address and RPC endpoint can be injected via environment variables

Create a local `.env` from [.env.example](.env.example), then put the token there. `.env` is ignored by Git and the deployment launcher tightens its permissions to `0600` when needed.

```bash
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
CLOUDFLARE_ACCOUNT_ID="your-account-id"
CLOUDFLARE_PROJECT_NAME="open-cooperation-experiment"
```

Then deploy without any browser or local login flow:

```bash
npm run cf:build
npm run cf:deploy
```

For a direct worker deploy, use:

```bash
npm run cf:deploy:worker
```

Other configuration variables:

- `CONTRACT_ADDRESS=EQBXKvC_gYJLNGpp4i5X0D__QMHhIa-9183D8HjJoWXKKs-U`
- `TONRPC_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC`

Deployment commands:

```bash
npm install
npm run cf:build
npm run cf:deploy
```

For a Worker-only setup, run the workers project with the same env vars and deploy via Wrangler with the token exported.

## Durable free rounds

The Worker uses the `open-cooperation-rounds` D1 database to persist free-round metadata and timer boundaries. The TON contract remains authoritative for participant commitments, reveals, resolution, and claims.

Available endpoints:

- `GET /api/rounds` lists the latest durable rounds.
- `POST /api/rounds` creates a free round record. Optional JSON fields are `roundId`, `contractAddress`, `startsAt`, `duration`, and `revealDuration`.
- `GET /api/rounds/:id` reads one round and refreshes its time-based status.

The dashboard countdown is derived from the contract's `startsAt`, commit duration, reveal duration, and current phase, so it remains accurate after a page refresh.

## Testnet token fixtures

The repo includes an explicit opt-in command for two real testnet jettons:

- `OPCO` / `Open Cooperation`: game token, 9 decimals
- `mUSDT` / `Open Cooperation Mock USDT`: mock stablecoin, 6 decimals

Run `npm run deploy:testnet-jettons` only when the funded Blueprint wallet is selected. The command prints each jetton master and the wallet address receiving the premint. These are testnet fixtures, not real GRAM or USDT, and must not be presented as mainnet assets.
