# Branded template integration

V0.8 provides the built-in Web template besttrack.branded at version 1. It
creates five blocks: announcement, tracking experience, recommendations, quick
links and Blog. The tracking experience is a composite consumer block: it owns
the shipment switcher, query hero and the successful-query result.

## Registry and Runtime

Register `bestTrackBrandedExtension` and use the same Registry in Editor,
preview and Storefront. Wrap the page once in `TrackingRuntimeProvider`.
`BrandedRuntimeProvider`, `SalesRuntimeProvider` and `ReadyToGoRuntimeProvider`
are compatibility names for that same Provider; do not nest them.

```tsx
// 只包一层公共 Provider；query 负责查单，queryRecommendations 独立加载页面推荐。
// BrandedRuntimeProvider 是同一组件的兼容名称，不需要再嵌套一次。
<TrackingRuntimeProvider
  query={serverAuthorizedTrackingQuery}
  queryRecommendations={serverAuthorizedRecommendationsQuery}
>
  <WebRenderer document={publishedDocument} registry={registry} />
</TrackingRuntimeProvider>
```

Branded keeps its visual layout and stable block IDs, and now uses the
[Ready-to-go business foundation](./ready-to-go-shared-foundation.md).
The host supplies explicit Mock callbacks in preview and server-authorized
callbacks in production. Alternatively, `transport` uses the original Shopify
Track Page query and independent recommendations adapters. No live failure
falls back to Mock; this is a business extension Runtime, not automatic
DataSource execution in Page Builder Core.

## Shared query and result rules

The query form supports tracking number, or order number plus email. Tabs
preserve inputs; submit trims values and checks only that required inputs are
non-empty, exactly as Ready-to-go does. Loading prevents duplicate submission.
The host remains responsible for trusted input validation and authorization.
URL synchronization, optional URL deep-link auto-query, generic failures and
empty results use the same logic across all three templates. Success, empty
and error remain inside Branded's original scrollable card.

The latest three successful queries are kept in Provider memory. Selecting a
recent query restores its result and inputs without a request; changing query
mode or order email starts a new history group. Selecting a shipment updates
progress, events, package contents, carrier, destination, estimated delivery
and advertisement from the same result. Selection invalidates older pending
requests. Neither query history nor order results are persisted.

Recommendations load independently on page mount through `queryRecommendations`
or the Shopify `transport`. Merchant `products` take priority when configured.
When the merchant has not selected products, the backend defaults to the first
eight products from that merchant's store. The host must connect the independent
recommendations loader to obtain them; the frontend preserves the returned list.
The block does not read `result.recommendations`, and query failure or shipment
selection never clears or changes the independent products. With no usable
products the region is hidden; legacy `hideWhenEmpty` remains readable in
saved documents but no longer changes this shared rule. The Branded grid stays
in place and recommendation prices follow Ready-to-go's `$ 0.00` display.

The composite tracking-experience and recommendations blocks are mandatory
and cannot be deleted or duplicated in the editor; announcement remains
protected. Existing documents are not automatically retrofitted with missing
blocks. See the shared foundation document for that compatibility boundary.

## Brand configuration

The template renders inside the Shopify Theme body and deliberately does not
render the store header or footer. Announcement is a compact promotion strip.
Before query, the tracking experience renders its hero background, query mode,
input and CTA; actual shipment switches appear after a successful query.
“Powered by BestTrack” visibility follows the shared host setting or original
Track Page rule and is not merchant-editable. After a successful query the same card retains
the form and appends the complete result: current status, estimated delivery,
five-stage progress, carrier and copyable tracking number, destination,
transit time, the complete supplied event timeline, advertisement and order
items. Empty carrier, destination, timeline or item data uses the same
Ready-to-go fallback messages. “Track another order” restores the idle tracking view.

Hosts may provide progress and events on each shipment. Provided progress entries use { id, label, state }, where state is complete,
current or upcoming; absent progress falls back to the standard five stages.
The full event list preserves the order supplied by the host; a missing list
uses the latest-event summary when present. `destination` must be city/region-level only;
`transitDuration`, `orderNumber`, `estimatedDelivery` and item `price` are
optional display-safe values. `orderItems` show title, description, quantity,
image and money in minor units; `compareAtAmount` renders only when it exceeds
the sale amount. These are active-request data only, not data to persist in
PageDocument.

The default surface uses an off-white #fffdf0 background, #000 primary action,
#0a0a0a text, #e7e7e7 borders, an Arial-like system font and 10px radii.
The hero card has a 560px maximum width and a responsive 520px to 560px hero
height. Set approved overrides in PageDocument.theme; WebRenderer applies the
template theme, document theme, variant theme and block style in that order.
Do not persist arbitrary CSS or untrusted style strings.

`autoQueryDemo` is restricted to explicit Mock previews and hides estimated
delivery. Production hosts leave it off; URL auto-query has its own flag.

## Storefront acceptance

Before merging a release, validate in a real Shopify development store:

- The exact same Registry renders the published document.
- The live query is performed only by the authorized host Runtime.
- The promotion, shipment tabs, hero card, content, colours, font and radius
  match Editor and Preview.
- Shipment switching updates the progress, events, package contents and ad
  together while independent recommendations remain stable.
- At 320px, the in-card result has no horizontal scrolling, tabs and result
  actions have 44px touch targets, and only the card scrolls vertically.
- Invalid or empty query results and bad resource links show controlled states.
- The surface has no visible collision with the active Shopify Theme.
