# Branded template integration

V0.8 provides the built-in Web template besttrack.branded at version 1. It
creates five blocks: announcement, tracking experience, recommendations, quick
links and Blog. The tracking experience is a composite consumer block: it owns
the shipment switcher, query hero and the successful-query result.

## Registry and Runtime

Register bestTrackBrandedExtension alongside the business extension that owns
besttrack.tracking.query. Render the Editor, preview and Storefront document
with this same Registry. The Branded blocks are deliberately presentation-only:
the host supplies a BrandedRuntimeProvider (or an equivalent host wrapper)
with a `TrackingPageQuery`: an explicit mock query in preview and a
server-authorized live query in production. The sole query contract is the
discriminated `TrackingPageQuery`: tracking number, or order number plus email.

The query result is shared by the tracking experience and recommendations
blocks. A result may expose multiple shipments; selecting one changes the
tracking number, state, five-stage progress, shipping-event timeline, package
contents and recommendations together without issuing another query. An
`outcome: "empty"` result and an unavailable live query have controlled,
generic storefront states; the raw host error is not displayed. The template
does not register a second DataSource and never falls back from a live failure
to mock data.

## Shared query card

Branded and Sales use the same consumer query interaction. The card always
shows tracking-number and order-number tabs, preserves values while switching,
validates each field before calling the host, and focuses the first invalid
field. A valid submit disables the CTA while loading. Success, empty and
generic-error states appear inside the original scrollable card; the card, not
the document page, smoothly scrolls to the new state. The order-number path
always requires the email field.

## Brand configuration

The template renders inside the Shopify Theme body and deliberately does not
render the store header or footer. Announcement is a compact promotion strip.
Before query, the tracking experience renders shipment tabs, hero background,
query mode, input and CTA. “Powered by BestTrack” is a fixed platform
identifier and is not editable. After a successful query the same card retains
the form and appends the complete result: current status, estimated delivery,
five-stage progress, carrier and copyable tracking number, destination,
transit time, latest three shipping events with an expansion bounded to 50,
and order items. “Track another order” restores the idle tracking view.

Hosts may provide progress and events on each shipment. Progress must contain
five ordered entries of { id, label, state }, where state is complete, current
or upcoming; a malformed or absent sequence falls back to the standard five
stages. Events are ordered newest-first and the UI shows three initially or at
most 50 after expansion. `destination` must be city/region-level only;
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

## Storefront acceptance

Before merging a release, validate in a real Shopify development store:

- The exact same Registry renders the published document.
- The live query is performed only by the authorized host Runtime.
- The promotion, shipment tabs, hero card, content, colours, font and radius
  match Editor and Preview.
- Shipment switching updates the progress, events, package contents and
  recommendations together.
- At 320px, the in-card result has no horizontal scrolling, tabs and result
  actions have 44px touch targets, and only the card scrolls vertically.
- Invalid or empty query results and bad resource links show controlled states.
- The surface has no visible collision with the active Shopify Theme.
