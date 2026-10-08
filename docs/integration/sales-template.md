# Sales template integration

The built-in Sales template is besttrack.sales version 3. Keep the template ID
and the eight block types in
this order when creating a new template document:

1. besttrack.sales.announcement
2. besttrack.sales.query
3. besttrack.sales.order-items
4. besttrack.sales.other-tracking
5. besttrack.sales.service-cards
6. besttrack.sales.product-categories
7. besttrack.sales.featured-product
8. besttrack.sales.recommendations

A host must call `migratePageDocument`, then
`validatePageDocumentWithRegistry`, at its draft and published-read boundaries
before rendering with the same registered bestTrackSalesExtension used by
Editor and Preview.

## Sales Hero visual default

New Sales documents use the `hero` Variant. The Hero treatment is a pale announcement
strip followed by a dark, full-width merchant-image hero and centered query
card. Its palette, type, radius, spacing, panels, item cards, shipment cards,
service cards, collection link and recommendation grid use the controlled
Theme Tokens; no arbitrary CSS is stored in the document.

New pages receive an HTTPS merchant-configurable hero image default. Sales validates that supplied
hero URLs are HTTPS and renders them as a decorative image element rather than
interpolating a document value into CSS. A missing, invalid, or failed image
uses the dark hero fallback. Product images have the same HTTPS-only fallback.

The Consumer Runtime contract supports two explicit modes: tracking number, or
order number plus email. Sales renders both tabs and preserves each tab's
inputs. All three templates use Ready-to-go’s trimmed, non-empty input rules, URL
synchronization and loading lock. Sales retains first-error focus and
card-internal smooth scrolling as presentation behavior. The submitted
result, empty state or generic failure remains inside the query card; the page
itself does not scroll or navigate. `defaultTrackingNumber` remains a
preview-only, non-sensitive placeholder.

On success, the card renders a complete display-safe result: status, optional
estimated delivery, five-stage progress, carrier and copyable tracking number,
destination, transit time, recent shipping events and order items. The timeline shows the complete event list in host order, falling back to the
latest-event summary when no list is supplied. Order-item prices use
minor currency units supplied by the host; a compare-at price appears only
when it is greater than the sale amount. Missing item images use an accessible
placeholder and an absent item list shows the Ready-to-go package-content
fallback. The result also includes the shared advertisement slot.

## Consumer Runtime dependency

Sales uses the same `TrackingRuntimeProvider` as Ready-to-go and Branded.
`SalesRuntimeProvider` remains a compatibility name for that Provider. Wrap
the page once and supply the host-authorized discriminated `TrackingPageQuery`
and an independent `TrackingPageRecommendationsQuery`:

```tsx
// 查单与推荐分别注入，推荐不会随着所选包裹变化而重新请求。
// resourceResolution 是宿主解析好的商品/集合结果，Provider 本身不会调用 Shopify 资源接口。
<TrackingRuntimeProvider
  query={serverAuthorizedTrackingQuery}
  queryRecommendations={serverAuthorizedRecommendationsQuery}
  resourceResolution={resolvedResources}
>
  <WebRenderer document={publishedDocument} registry={registry} />
</TrackingRuntimeProvider>
```

The [Consumer Runtime API contract](./consumer-runtime-api.md) can back the host
query. This repository does not provide a Go client, BFF endpoint or automatic
DataSource execution. The host enforces server-side authorization and input
constraints; the shared UI checks non-empty values rather than the former
6–64-character/strict-email template rule. An injected query error remains a
controlled error. The original Shopify `transport` adapter instead maps
business failure or retry exhaustion to `empty`, as Ready-to-go does. No live
failure falls back to Mock.

Successful queries populate the latest three entries in memory. Selecting one
restores its result and form inputs without querying; changing mode or order
email starts a new history group. Package switches update progress, timeline,
items, carrier, destination, estimated delivery and ad together. Old pending
requests cannot overwrite a selected history entry or package.

Recommendations load on page mount independently of tracking. Non-empty
merchant `products` take priority; otherwise `queryRecommendations` or the
Shopify `transport` supplies them. `result.recommendations` is not consumed.
When the merchant has not selected products, the backend defaults to the first
eight products from that merchant's store. The host must connect the independent
recommendations loader to obtain them; the frontend preserves the returned list.
No products means no rendered recommendation content; errors, query switching
and shipment switching do not alter independently loaded recommendations.
Prices follow Ready-to-go's `$ 0.00` recommendation display; Sales retains its
grid layout. `autoQueryDemo` is only for explicit Mock previews and suppresses
estimated delivery; production hosts omit it.

The query, order-items, other-tracking and recommendations blocks cannot be
deleted or duplicated in the editor; announcement keeps its existing lock.
New documents contain all base capabilities. Existing missing blocks are not
automatically inserted and historical documents need host review; see
[Ready-to-go shared foundation](./ready-to-go-shared-foundation.md).

## Editor and resources

Sales definitions validate required merchant-authored text, the preview-only
tracking placeholder, and the collection ID/label. The editor blocks Save
and Publish when these checks, or a configured block Variant, are invalid. The
allowed link scheme is public HTTPS; HTTP is limited to localhost during local
development. Browser rendering enforces the same link policy, rejects missing/invalid image URLs with an
accessible fallback, and does not fetch collections, products, or DataSources
itself.

defaultTrackingNumber is only a non-sensitive preview placeholder. Never save
a customer's tracking number, order data, token, credential, or live result in
a Sales PageDocument or binding.params. Collection references remain JSON-only
merchant configuration; authorization and resolution belong to the Consumer
Runtime API or another trusted host service.

## Storefront acceptance

- Query controls remain usable at narrow widths and announce loading/error
  state to assistive technology.
- The Hero card, input and full-width action remain usable at mobile widths;
  its background is decorative and does not convey query instructions alone.
- At 320px, there is no horizontal result overflow; tab and result actions have
  44px touch targets, and result content scrolls inside the Hero card.
- Tracking-number and order-number/email controls both use the authorized
  discriminated Runtime contract.
- All customer-facing query results use controlled loading, empty and generic
  error states; raw host errors are never displayed.
- Merchant-authored links allow only public HTTPS destinations.
- The host manually tests the published page in its production storefront
  theme at mobile and desktop widths.
