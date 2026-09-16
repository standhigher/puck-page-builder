# BestTrack Page Builder

V0.1 is a pnpm monorepo. The reusable package is `packages/puck-page-builder`; its real Next.js Shopify Demo is `demos/shopify-app`; component-level validation stays in `demos/v0.1/`.

## Run

```bash
pnpm install
cp demos/shopify-app/.env.example demos/shopify-app/.env.local
pnpm dev
```

The Next.js URL is the manual acceptance entry point. To use the embedded Shopify App path, configure the development-store values in `demos/shopify-app/.env.local` and `shopify.app.toml` before running Shopify CLI.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

V0.1 uses local demo block data only. It has no PageDocument, data source, API request, persistence, publish integration, version API, or Shopify Menu call.
