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

/** The UI receives an injected function; it never knows a Go endpoint or credential. */
export type TrackingPageQuery = (trackingNumber: string) => Promise<TrackingPageQueryResult>;

export type TrackingPageRuntimePhase = "idle" | "loading" | "success" | "empty" | "error";

export function isEmptyTrackingPageResult(result: TrackingPageQueryResult) {
  return result.outcome === "empty";
}
