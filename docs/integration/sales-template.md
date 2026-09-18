# Sales template integration

The built-in Sales template is besttrack.sales version 1. Its document shape
is a compatibility contract: keep the template ID and the seven block types in
this order when creating a new template document:

1. besttrack.sales.announcement
2. besttrack.sales.query
3. besttrack.sales.order-items
4. besttrack.sales.other-tracking
5. besttrack.sales.service-cards
6. besttrack.sales.product-categories
7. besttrack.sales.recommendations

Existing published Sales documents continue to use their original sales-1
through sales-7 block IDs. A host must migrate/validate the stored document at
its published-read boundary, then render it with the same registered
bestTrackSalesExtension used by Editor and Preview.

## Sales Hero visual default

New Sales documents use the `hero` Variant while retaining every existing
`commerce` (and applicable `minimal`, `compact`, and `grid`) Variant for
published-document compatibility. The Hero treatment is a pale announcement
strip followed by a dark, full-width merchant-image hero and centered query
card. Its palette, type, radius, spacing, panels, item cards, shipment cards,
service cards, collection link and recommendation grid use the controlled
Theme Tokens; no arbitrary CSS is stored in the document.

`heroImageUrl` is optional so existing v1 documents remain valid. New pages
receive an HTTPS merchant-configurable default. Sales validates that supplied
hero URLs are HTTPS and renders them as a decorative image element rather than
interpolating a document value into CSS. A missing, invalid, or failed image
uses the dark hero fallback. Product images have the same HTTPS-only fallback.

The current Consumer Runtime contract accepts tracking identifiers only.
Sales therefore deliberately renders one tracking-number input and no
clickable "Order Number" tab. `defaultTrackingNumber` remains a preview-only,
non-sensitive placeholder.

## Consumer Runtime dependency

Sales has one external runtime dependency: a host-injected TrackingPageQuery,
normally backed by the Go Consumer Runtime API described in
[Consumer Runtime API contract](./consumer-runtime-api.md). This repository
does not provide a Go client, BFF, network endpoint, or automatic DataSource
execution.

The host validates a 4–64-character tracking identifier, supplies trusted
tenant/page/visitor authorization context to the Go service, and maps only the
display-safe response into TrackingPageQueryResult. A live failure must reject
the query so Sales can show its generic error; it must never be replaced with
mock data. The Go service's credentials, merchant-admin credentials, customer
address, raw error payload and full tracking identifier stay out of the
PageDocument, browser logs and UI.

    <SalesRuntimeProvider queryTracking={serverAuthorizedTrackingQuery}>
      <WebRenderer document={publishedDocument} registry={registry} />
    </SalesRuntimeProvider>

outcome: empty is a successful no-result lookup. The query, order-items,
other-shipments and recommendations blocks share the resulting transient
state, including explicit loading, empty and generic-error displays.

There is no Go Consumer Runtime API expansion in this release. If a host later
wants an order-number experience, it must first add an explicit, server-validated
query-mode contract to the Consumer Runtime API (with separate authorization,
input validation and display-safe result rules); Sales must not infer that mode
from a browser tab or send an order identifier through `trackingNumber`.

## Editor and resources

Sales definitions validate required merchant-authored text, the preview-only
tracking placeholder, and the collection ID/label/link. The editor blocks Save
and Publish when these checks, or a configured block Variant, are invalid. The
allowed link schemes are a site-relative path or HTTPS. Browser rendering
enforces the same link policy, rejects missing/invalid image URLs with an
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
- Only a tracking-number control is present unless a future host contract adds
  an authorized query mode.
- All customer-facing query results use controlled loading, empty and generic
  error states; raw host errors are never displayed.
- Product and collection links allow only relative or HTTPS destinations.
- The host manually tests the published page in its production storefront
  theme at mobile and desktop widths.
