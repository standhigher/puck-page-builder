# @standhigher/besttrack-page-extension

This package provides the built-in Ready-to-go, Branded, and Sales tracking
templates for `@standhigher/puck-page-builder`. Each template has stable
namespaced v1 block IDs, default block order, theme tokens, and exported
`TemplatePolicy` metadata. All default blocks are singleton. Protected
query/structure blocks now use the core `BlockDefinition.policy` contract
(`required`, `singleton`, and `allowDelete: false`), which the editor enforces.
Recommendation blocks stay singleton and can be deleted.

## Editor interface language

Editor copy is owned by the package's dependency-free `/admin` entry. Supply the
same `adminLocale` used by `PageDocumentEditorShell`; the package supports English,
Simplified Chinese, Spanish, European Portuguese, and French. Regional language
tags such as `pt-PT` are normalized, and unknown or omitted languages use English.

```ts
import {
  createBestTrackAdminI18n,
  getReadyToGoEditorCopy,
  getRecommendationEditorCopy,
} from "@standhigher/besttrack-page-extension/admin";

const { t } = createBestTrackAdminI18n(adminLocale);
const { blockLabels, fieldLabels } = getReadyToGoEditorCopy(adminLocale);
const pickerCopy = getRecommendationEditorCopy(adminLocale);
const limit = t("editor.fields.style.limit", { max: 100 });
```

Use `blockLabels` and `fieldLabels` for editor registry metadata. Host-rendered
branding, preview, upload, and product picker UI can use the typed `t` function
or picker copy. Hosts retain their fetching, persistence, and selection adapters.
Changing the interface language never changes `defaultProps`, a merchant's
content, canvas text, or `PageDocument.settings.locale`.

## Storefront tracking language

**Translate updates** is a consumer-page control. It works on the published
tracking page and in the editor canvas. Both surfaces share
`TrackingRuntimeProvider` `locale`; switching language in the canvas is a
preview of the same runtime, not an editor-only toggle.

Default is **`EN`**. Resolution order is `?lang=`, then `bestrack_locale`,
then English. Browser `navigator.language` is not read. The menu lists the
original Track Page locales: `EN`, `ZH-HANS`, `FR`, `ES`, `DE`, `PT-BR`,
`IT`, `ID`, `VI`, `TH`.

The menu sits in the top-right of the shipment progress card (Ready-to-go)
or next to the tracking timeline (Branded / Sales). Ready-to-go keeps the
tracking number centered when it fits on one row with the control. On
viewports or progress-card containers ≤640px, or when they cannot share one
row, the control moves above the tracking number. Desktop shows globe +
**Translate updates** + chevron. Viewport widths ≤640px show a short
**Translate** pill without a chevron; the accessible name stays the full
phrase.

It sets Runtime `locale`, persists `bestrack_locale`, and syncs `?lang=`.
A **successful** lookup is re-queried in place with `lang` on the Shopify
`transport` path. Idle, empty, and error states are not retried. That
in-place refresh does not enter loading, so Searching... does not appear.
A new Track Your Order submit does show Searching..., and that string
follows the current Runtime locale.

English default chrome is translated **at render time** from the package
dictionary. That includes default headings such as Shipping Details,
Package Contents, and Carrier, plus progress labels, Searching..., empty
states, Reorder, tracking/order labels, and known demo event titles. The
translated string is displayed only. It is never written back into
`PageDocument`, `defaultProps`, or `settings.locale`.

Merchant-edited headings (any stored value other than the English default)
render exactly as saved in every language. Carrier-authored event text,
carrier names, destinations, and product titles also stay as returned.

This locale is not `adminLocale`. Do not pass a static `transport.locale`
snapshot; the runtime reads locale at request time. Custom `query`
callbacks do not receive `locale` on the request object; read `?lang=` or
`bestrack_locale` at call time if the host must translate carrier events.
Hosts that already inject `transport` or `query` only need to upgrade this
package. See `docs/integration/translate-updates.md`.

## Query provider

Branded and Sales still receive a host-owned `TrackingPageQuery` through `query`.
Ready-to-go storefront pages that keep the original Shopify Track Page backend
should inject `transport` instead of inventing a new request body:

```tsx
<ReadyToGoRuntimeProvider
  transport={{
    post: (url, body) => apiPost(withShopifyAppProxyPrefix(url, APP_PROXY_PREFIX), body)
  }}
>
  <WebRenderer document={document} registry={registry} />
</ReadyToGoRuntimeProvider>
```

That path reuses the original lookup: `POST /track/query?_t=`, snake_case
`{ order_number, email, tracking_number, lang }`, one retry, independent
`POST /products/recommend` with `{ page, page_size }`, the original Embla
recommendation carousel, and the original
progress / shipping / empty-state mapping. The host only supplies fetch,
App Proxy prefix, and credentials.

Branded and Sales keep the discriminated `query` callback:

```tsx
const query: TrackingPageQuery = async (request) => {
  if (request.mode === "tracking") {
    return serverAuthorizedTrackingLookup(request.trackingNumber);
  }
  return serverAuthorizedOrderLookup(request.orderNumber, request.email);
};

<SalesRuntimeProvider query={query} watermark={{ visible: true }}>
  <WebRenderer document={document} registry={registry} />
</SalesRuntimeProvider>
```

`TrackingPageQueryRequest` is either `{ mode: "tracking", trackingNumber }`
or `{ mode: "order", orderNumber, email }`. Ready-to-go matches the original
Track Page and only requires non-empty trimmed fields. Branded and Sales still
perform local PRD format checks. The host must authorize again on the server.
A host must not submit an order number through the tracking-number mode.

Branded and Sales render a two-tab query card on the Hero’s right edge at
desktop widths and as a single full-width card on narrow screens. Each tab
retains its own input. Loading, error, empty, and replacement results remain
inside the scrollable query card; successful requests scroll the result into
view. The package never stores tokens and never writes a query result into a
`PageDocument`.

## Watermarks and data safety

The optional `watermark` provider prop is a host override. Ready-to-go uses the
original powered-by hide rule when it is omitted. Branded and Sales only render
`watermark.visible` and its optional label; they do not infer entitlement.
Query results and watermark state are transient.

Document props and bindings must remain JSON-only and must not contain a token,
secret, customer order data, email address, or live query result. Merchant
resources use stable Shopify IDs. Catalog display prices may be stored on
product snapshots as `{ amount, currencyCode }` minor units; formatted price
strings, live availability, tokens, and secrets stay out of PageDocument.
Production URLs must be public HTTPS URLs. Missing display data and
unsafe resource URLs render controlled fallbacks.
