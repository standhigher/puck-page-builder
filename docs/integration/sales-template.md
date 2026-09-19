# Sales template integration

The built-in Sales template is besttrack.sales version 2. Keep the template ID
and the seven block types in
this order when creating a new template document:

1. besttrack.sales.announcement
2. besttrack.sales.query
3. besttrack.sales.order-items
4. besttrack.sales.other-tracking
5. besttrack.sales.service-cards
6. besttrack.sales.product-categories
7. besttrack.sales.recommendations

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
inputs. Both Sales and Branded use the same field-level validation, first-error
focus, loading lock and card-internal smooth scrolling behavior. The submitted
result, empty state or generic failure remains inside the query card; the page
itself does not scroll or navigate. `defaultTrackingNumber` remains a
preview-only, non-sensitive placeholder.

## Consumer Runtime dependency

Sales has one external runtime dependency: a host-injected TrackingPageQuery,
normally backed by the Go Consumer Runtime API described in
[Consumer Runtime API contract](./consumer-runtime-api.md). This repository
does not provide a Go client, BFF, network endpoint, or automatic DataSource
execution.

The host validates a 6–64-character tracking identifier containing letters,
numbers, hyphens or underscores, or an order number plus email, supplies trusted
tenant/page/visitor authorization context to the Go service, and maps only the
display-safe response into TrackingPageQueryResult. A live failure must reject
the query so Sales can show its generic error; it must never be replaced with
mock data. The Go service's credentials, merchant-admin credentials, customer
address, raw error payload and full tracking identifier stay out of the
PageDocument, browser logs and UI.

    <SalesRuntimeProvider query={serverAuthorizedTrackingQuery}>
      <WebRenderer document={publishedDocument} registry={registry} />
    </SalesRuntimeProvider>

outcome: empty is a successful no-result lookup. The query, order-items,
other-shipments and recommendations blocks share the resulting transient
state, including explicit loading, empty and generic-error displays.

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
- Tracking-number and order-number/email controls both use the authorized
  discriminated Runtime contract.
- All customer-facing query results use controlled loading, empty and generic
  error states; raw host errors are never displayed.
- Merchant-authored links allow only public HTTPS destinations.
- The host manually tests the published page in its production storefront
  theme at mobile and desktop widths.
