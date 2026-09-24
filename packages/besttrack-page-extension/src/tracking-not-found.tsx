import notFoundImage from "./shopify-track-page/assets/not-found.png";

/** Empty-state illustration and copy reused from the Shopify Track Page. */
export function TrackingNotFound({ resultAnchor = false }: { resultAnchor?: boolean } = {}) {
  return <section aria-label="Order not found" role="status" data-tracking-result={resultAnchor ? "" : undefined} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: 16 }}>
    <img src={notFoundImage} alt="" width={180} height={180} style={{ width: 180, height: 180, objectFit: "contain" }} />
    <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#475569" }}>Can not find order</p>
  </section>;
}
