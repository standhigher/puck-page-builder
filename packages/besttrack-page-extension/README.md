# @standhigher/besttrack-page-extension

V0.7.1 adds the besttrack.branded built-in template. Its announcement, order
query, order items, recommendations, quick links and Blog blocks use the
shared, host-injected `TrackingPageQuery` contract. The
`ReadyToGoTrackingQuery` name remains a compatible alias. Logo and content are
JSON-only block props; brand colour, font and radius use the template Theme
Tokens and may be overridden through PageDocument.theme.

V0.7.0 provides the Ready-to-go built-in template: order query, shipment
progress, delivery information and recommendations. The consumer surface follows
the Shopify Track Page layout (query card, five-step progress, shipping
timeline, package contents and product cards) using inline styles and `--pb-*`
Theme Tokens. Live tracking is injected by the host Runtime; this package never
stores credentials or network endpoints in a `PageDocument`.

V0.7.2 Sales uses the shared, transient `TrackingPageQuery` contract exported
by this package. The external Go Consumer Runtime API owns live-query
authorization and transport; Sales only receives its display-safe result and
never falls back to mock data after a live failure.

Sales keeps the stable `besttrack.sales` v1 template and seven block IDs.
Its host must inject the query from an authorized Consumer Runtime flow; this
package provides neither a Go client nor a BFF. The editor validates
merchant-authored text, preview-only tracking placeholders and collection
links, while the storefront renders only site-relative or HTTPS resource
links. See `docs/integration/sales-template.md` and
`docs/integration/consumer-runtime-api.md` for the host contract.
