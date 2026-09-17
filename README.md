# BestTrack Page Builder

For the V0.7.1 brand configuration and Storefront acceptance path, see the
[Branded template guide](./docs/integration/branded-template.md).

V0.1.1 contains the reusable package `@standhigher/puck-page-builder` and its
workspace-linked Next.js Shopify Demo in `demos/shopify-app`. All component and
integration examples remain under `demos/`.

## Integration documentation

For production Web rendering, business extensions, host Runtime responsibilities
and DataSource boundaries, start with [docs/integration](./docs/integration/README.md).
AI-assisted integration and development should begin with the repository's
`AGENTS.md` and [AI integration guide](./docs/integration/ai-integration-guide.md).

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

## V0.3 scope boundary

V0.3 adds the framework-independent Extension API and immutable Registry for
Block, Field, Action, Template, Renderer, DataSource, Lifecycle Hooks and UI
Slots. Business code consumes the separate
`@standhigher/puck-page-builder/extensions` entry point, which does not expose
Puck types. The Shopify Demo includes an independently assembled BestTrack
extension: turn it off to confirm that all of its registered capabilities are
removed, then run its Toolbar Action and Template check when it is enabled.

V0.3 does **not** introduce complete block authoring, drag-and-drop, persistent
drafts, live business-data requests, publishing, version rollback, or Shopify
menu mutations.

## V0.4 scope boundary

V0.4 adds client-side PageDocument authoring to the same Shopify Demo: add,
copy, delete and native drag-sort blocks; configure their properties; select a
block across outline, canvas and inspector; undo/redo (including Cmd/Ctrl+Z and
Cmd/Ctrl+Shift+Z); an unsaved-change leave warning; and desktop, tablet and
mobile canvas previews. `EditorProvider` exposes the document actions and their
availability through `EditorActionState`. The Admin copy catalog starts with
Chinese and English, while the page locale remains part of `PageDocument`.

The V0.4 history is in memory only. It deliberately adds no draft persistence,
migration, publish, versioning, or backend request capability. Its interaction
checks are contained in `demos/v0.4`.

## V0.5 scope boundary

V0.5 adds draft persistence and publishing to the Shopify Demo. The editor only
clears its unsaved-change state after the draft or publish request succeeds, and
the preview reads the last published PageDocument. The Demo migrates its legacy
session document into the new draft API on first load. Its process-memory store
is deliberately a Demo adapter, not a production persistence implementation.

The V0.5 API is available at:

- `GET` / `PUT` `/api/page-documents/:pageId/draft`
- `GET` / `POST` `/api/page-documents/:pageId/published`

V0.5 intentionally does not add business-data requests, live DataSource
implementations, or data binding. Its persistence and API checks are contained
in `demos/v0.5`.
