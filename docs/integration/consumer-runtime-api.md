# Consumer Runtime API contract

The external Go service is the Consumer Runtime API for published tracking
pages. This repository does not add a BFF or a Go client: the storefront host
injects a `TrackingPageQuery` into the template runtime and owns its transport,
authentication and request lifecycle.

## Boundary

```text
published PageDocument → migratePageDocument → storefront host → Consumer Runtime API
                                                          ↓
                                             transient TrackingPageQueryResult
                                                          ↓
                                                Sales/Branded/Ready-to-go UI
```

The Go service receives tenant, page, visitor and authorization context from
trusted server-side infrastructure. The browser may submit only the entered
tracking or order identifier through the host's controlled query function. It
must not receive service credentials, merchant-admin credentials, internal
resource identifiers beyond what is needed for display, or a raw upstream
error.

## Required logical request

The transport is deliberately not prescribed here. Its logical payload is:

```ts
type TrackingPageQueryRequest =
  | { mode: "tracking"; trackingNumber: string } // 6–64 letters, numbers, hyphens or underscores
  | { mode: "order"; orderNumber: string; email: string };
```

The storefront must never submit an order identifier through `trackingNumber`.
Order mode requires both values and an independent server-side authorization
check before reaching commerce or carrier systems.

The Consumer Runtime API must determine the tenant and authorization scope
from trusted request context, not from a `PageDocument`, browser-supplied shop
ID, or a client-side token. It should reject invalid input before calling an
upstream carrier or commerce system.

## Required logical response

On a successful lookup the API returns the display-safe shape exported as
`TrackingPageQueryResult` by `@standhigher/besttrack-page-extension`.
`outcome: "empty"` is a successful query with no result. Optional item, shipment and
recommendation fields are for the active response only. They must not be
written into the PageDocument or `binding.params`.

For the Branded and Sales in-card result, the host may return `carrier`,
`estimatedDelivery`, city/region-only `destination`, `transitDuration`,
`orderNumber`, five ordered `progress` entries, and newest-first `events`.
Each order item may contain title, description, quantity, HTTPS image/link and
`price` as `{ amount, currencyCode, compareAtAmount?, startsAt? }`, where all
amounts are integer minor units. The UI exposes at most 50 events and only
renders a compare-at value when it is greater than `amount`. Do not return a
street address, phone number, email address, payment data, credentials or raw
upstream payload.

For failures, return a stable, non-sensitive classification suitable for host
telemetry (for example `invalid_query`, `unauthorized`, `rate_limited`,
`unavailable`, or `upstream_failure`). The consumer UI shows a generic error;
the host may log the classification, duration and correlation ID but not the
full tracking number, customer address, token or raw upstream body.

## Resource references and rendering

Sales document props may retain a JSON-only stable Shopify resource reference
and minimal merchant-authored display copy, such as a collection ID and label.
Any authorization or resolution of that reference belongs to the
Consumer Runtime API or another trusted service. Sales blocks do not make
resource requests themselves. Invalid links and missing images render a
controlled fallback rather than a broken resource.

## Shopify resource selector and Runtime resolution

The Admin editor receives a `ShopifyResourceBrowser` from its host. That host
owns resource browse/search/pagination and authorization; the picker component
does not contain a Shopify Admin API client. A selected product or collection
is persisted only as JSON:

```ts
{ id: "gid://shopify/Product/123", kind: "product", title: "T-shirt", handle: "t-shirt" }
```

The trusted Runtime separately receives the saved references and returns a
transient `ShopifyResourceResolution`. It may provide a public product or
collection URL, image URL, and product availability (`available`, `sold-out`,
`unavailable`, or `unknown`). Results must be scoped by the trusted shop/page
context, not a browser-supplied shop ID. The Runtime does not write resolved
values into the `PageDocument`; a failed live resolution becomes a controlled
missing/unavailable state and never falls back to mock data.

The Shopify Demo route is an authenticated server-side proxy to
`SHOPIFY_RESOURCE_RUNTIME_URL`. Its BFF request has `mode: "search"` or
`mode: "resolve"`, trusted `shop` context, and either search input or resource
references. The optional `SHOPIFY_RESOURCE_RUNTIME_TOKEN` stays server-only.
Configure that BFF to call Shopify Admin APIs or another authorized catalog
service; do not move that call into the browser or template block.

## Host integration checklist

- Read the published document and call `migratePageDocument` at the boundary.
- Build the same deterministic `ExtensionRegistry` used by editor and preview.
- Inject a live `TrackingPageQuery` only from authorized server-side flow; use
  an explicit mock only for local or preview use.
- Do not fall back from a live failure to mock data.
- Keep query results in transient runtime state; never persist them in a
  PageDocument, client store intended for drafts, or logs.
