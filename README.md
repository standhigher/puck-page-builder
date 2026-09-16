# BestTrack Page Builder

V0.1.1 contains the reusable package `@standhigher/puck-page-builder` and its
workspace-linked Next.js Shopify Demo in `demos/shopify-app`. All component and
integration examples remain under `demos/`.

## Local Builder UI review

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/page-builder`. Direct local access deliberately runs
in standalone mode: it validates the Builder UI, Puck iframe canvas and local
demo interactions, without loading App Bridge or calling a Shopify service.

## Shopify development-store review

1. Copy `demos/shopify-app/.env.example` to `demos/shopify-app/.env.local`.
2. Set `NEXT_PUBLIC_SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` from the linked
   Shopify app. Never commit this file.
3. From `demos/shopify-app`, start the Shopify CLI preview:

   ```bash
   shopify app dev
   ```

4. Install/open the app from the selected development store. The embedded page
   loads App Bridge, exposes **验证 Session Token**, and verifies the token at
   `/api/auth/session` without returning the token itself.
5. Open `https://<shop>.myshopify.com/apps/besttrack-page-builder` to exercise
   the configured App Proxy. The proxy route verifies Shopify's signature before
   returning its test response.

`shopify.web.toml` starts the Next.js process for CLI, and `shopify.app.toml`
contains the App Proxy configuration and its minimal `write_app_proxy` scope.

## Automated checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
shopify app config validate --path demos/shopify-app --client-id b619d8b384633280bb72ad2004be8993
```

## V0.2 scope boundary

V0.2 adds a framework-independent `PageDocument V1`, strict schema validation,
Text and Image example blocks, Puck `toEngineData` / `fromEngineData` adapters,
and a minimal `WebRenderer`. The Demo loads the same PageDocument into the
editor and `/page-builder/preview`; **导出 PageDocument** shows the current,
edited document without storing Puck data.

This version does **not** introduce persistent drafts, Extension Registry,
business data sources, real publishing, version rollback, or Shopify menu
mutations.
