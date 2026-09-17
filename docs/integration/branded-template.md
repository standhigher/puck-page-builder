# Branded template integration

V0.7.1 provides the built-in Web template besttrack.branded at version 1. It
creates six blocks: announcement, order query, order items, recommendations,
quick links and Blog.

## Registry and Runtime

Register bestTrackBrandedExtension alongside the business extension that owns
besttrack.tracking.query. Render the Editor, preview and Storefront document
with this same Registry. The Branded blocks are deliberately presentation-only:
the host supplies a ReadyToGoRuntimeProvider (or an equivalent host wrapper)
with an explicit mock query in preview and a server-authorized live query in
production.

The query result is shared by the order-items and recommendations blocks. The
template does not register a second DataSource and never falls back from a live
failure to mock data.

## Brand configuration

The announcement block stores brandName, logoUrl and message; the other blocks
store only their display content and safe navigation URLs. These are JSON props
and must not include tokens or order-private data.

The template supplies the default primary colour #7c3aed, Georgia font and an
18px radius. Set approved overrides in PageDocument.theme; WebRenderer applies
the template theme, document theme, variant theme and block style in that
order. Do not persist arbitrary CSS or untrusted style strings.

## Storefront acceptance

Before merging a release, validate in a real Shopify development store:

- The exact same Registry renders the published document.
- The live query is performed only by the authorized host Runtime.
- Logo, content, colours, font and radius match Editor and Preview.
- Invalid or empty query results and bad resource links show controlled states.
- The surface has no visible collision with the active Shopify Theme.
