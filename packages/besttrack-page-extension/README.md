# @standhigher/besttrack-page-extension

V0.7.1 adds the besttrack.branded built-in template. Its announcement, order
query, order items, recommendations, quick links and Blog blocks use the same
host-injected tracking query contract as Ready-to-go. Logo and content are
JSON-only block props; brand colour, font and radius use the template Theme
Tokens and may be overridden through PageDocument.theme.

V0.7.0 provides the Ready-to-go built-in template: order query, shipment progress, delivery information and recommendations. Live tracking is injected by the host Runtime; this package never stores credentials or network endpoints in a `PageDocument`.
