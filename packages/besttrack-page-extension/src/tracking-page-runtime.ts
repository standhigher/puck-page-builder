/**
 * Display-safe, transient data returned by a Consumer Runtime query.
 *
 * These types intentionally describe the boundary between a storefront host
 * and the template. They are not PageDocument props and must never be saved
 * with a draft or published document.
 */
export type TrackingPageOrderItem = {
  id: string;
  title: string;
  quantity: number;
  imageUrl?: string;
  description?: string;
  href?: string;
};

export type TrackingPageRecommendation = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  href?: string;
  price?: string;
};

export type TrackingPageTrackingStep = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming";
  date?: string;
  icon?: "check" | "bag" | "truck" | "box";
};

export type TrackingPageTrackingEvent = {
  id: string;
  title: string;
  at?: string;
  detail?: string;
  state?: "complete" | "current" | "upcoming";
};

export type TrackingPageShipment = {
  id: string;
  label: string;
  trackingNumber?: string;
  status?: string;
  carrier?: string;
  latestEvent?: string;
  updatedAt?: string;
  deliveryAddress?: string;
  estimatedDelivery?: string;
  progress?: TrackingPageTrackingStep[];
  events?: TrackingPageTrackingEvent[];
  orderItems?: TrackingPageOrderItem[];
  recommendations?: TrackingPageRecommendation[];
};

export type TrackingPageQueryResult = {
  /** `empty` is a successful query with no customer-visible tracking result. */
  outcome?: "found" | "empty";
  trackingNumber: string;
  status: string;
  carrier?: string;
  latestEvent?: string;
  updatedAt?: string;
  deliveryAddress?: string;
  estimatedDelivery?: string;
  progress?: TrackingPageTrackingStep[];
  events?: TrackingPageTrackingEvent[];
  orderItems?: TrackingPageOrderItem[];
  recommendations?: TrackingPageRecommendation[];
  shipments?: TrackingPageShipment[];
};

/** A carrier lookup. The browser only supplies the display-safe identifier. */
export type TrackingPageTrackingQueryRequest = {
  mode: "tracking";
  trackingNumber: string;
};

/** An order lookup always carries both values; hosts must authorize it separately. */
export type TrackingPageOrderQueryRequest = {
  mode: "order";
  orderNumber: string;
  email: string;
};

/**
 * The injected host boundary. It deliberately contains no endpoint, token,
 * tenant, or PageDocument data. The host owns authorization and transport.
 */
export type TrackingPageQueryRequest = TrackingPageTrackingQueryRequest | TrackingPageOrderQueryRequest;
export type TrackingPageQuery = (request: TrackingPageQueryRequest) => Promise<TrackingPageQueryResult>;

/** @deprecated Pass `query` to a RuntimeProvider with `TrackingPageQuery` instead. */
export type LegacyTrackingPageQuery = (trackingNumber: string) => Promise<TrackingPageQueryResult>;

/** Host-decided display state. This package never derives entitlement status. */
export type TrackingPageWatermark = Readonly<{
  visible: boolean;
  label?: string;
}>;

export type TrackingPageRuntimePhase = "idle" | "loading" | "success" | "empty" | "error";

/** PRD input rules; hosts must validate again before reaching any upstream. */
export function isValidTrackingNumber(value: string) {
  return /^[A-Za-z0-9-]{4,64}$/.test(value);
}

export function isValidOrderNumber(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9-]{3,63}$/.test(value);
}

export function isValidOrderEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function isEmptyTrackingPageResult(result: TrackingPageQueryResult) {
  return result.outcome === "empty";
}
