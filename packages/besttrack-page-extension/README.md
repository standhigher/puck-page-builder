# @standhigher/besttrack-page-extension

This package provides the built-in Ready-to-go, Branded, and Sales tracking
templates for `@standhigher/puck-page-builder`. Each template has stable
namespaced v1 block IDs, default block order, theme tokens, and exported
`TemplatePolicy` metadata. All default blocks are singleton. Protected
query/structure blocks now use the core `BlockDefinition.policy` contract
(`required`, `singleton`, and `allowDelete: false`), which the editor enforces.

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
`POST /products/recommend` with `{ page, page_size }`, and the original
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
resources use stable Shopify IDs; product prices and availability are Runtime
data. Production URLs must be public HTTPS URLs. Missing display data and
unsafe resource URLs render controlled fallbacks.
