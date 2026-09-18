# @standhigher/besttrack-page-extension

This package provides the built-in Ready-to-go, Branded, and Sales tracking
templates for `@standhigher/puck-page-builder`. Each template has stable
namespaced v1 block IDs, default block order, theme tokens, and exported
`TemplatePolicy` metadata. All default blocks are singleton; the protected
query/structure blocks declare `deletable: false`. Current core APIs do not
enforce this metadata, so a template-aware editor host must enforce it until a
core policy API is available.

## Query provider

New integrations pass the discriminated `TrackingPageQuery` through the
`query` prop on each RuntimeProvider:

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
or `{ mode: "order", orderNumber, email }`. The templates perform local PRD
format checks, but the host must validate and authorize again on the server.
The deprecated `queryTracking` prop remains a tracking-only compatibility
bridge; it cannot safely authorize an order-and-email request.

Branded and Sales render a two-tab query card on the Hero’s right edge at
desktop widths and as a single full-width card on narrow screens. Each tab
retains its own input. Loading, error, empty, and replacement results remain
inside the scrollable query card; successful requests scroll the result into
view. The package makes no API, Shopify, authentication, rate-limit, or
persistence calls and never writes a query result into a `PageDocument`.

## Watermarks and data safety

The optional `watermark` provider prop is an opaque host decision. This package
only renders `watermark.visible` and its optional label; it does not infer or
evaluate entitlement. For v0.7 tracking-only `queryTracking` compatibility,
the historical “Powered by BestTrack” label is retained; new `query`
integrations render a watermark only when the host supplies its state. Query
results and watermark state are transient.

Document props and bindings must remain JSON-only and must not contain a token,
secret, customer order data, email address, or live query result. Missing
display data and unsafe resource URLs render controlled fallbacks.
