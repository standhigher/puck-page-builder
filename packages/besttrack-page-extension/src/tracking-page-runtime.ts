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
  price?: TrackingPageMoney;
};

/** A stable Shopify object reference stored in PageDocument props. */
export type TrackingPageResourceReference = Readonly<{
  id: string;
  kind: "product" | "collection" | "media";
}>;

export type TrackingPageProductReference = TrackingPageResourceReference & { kind: "product" };
export type TrackingPageCollectionReference = TrackingPageResourceReference & { kind: "collection" };
export type TrackingPageMediaReference = TrackingPageResourceReference & { kind: "media" };

/** Values are minor currency units; formatted display strings never persist in PageDocument. */
export type TrackingPageMoney = Readonly<{
  amount: number;
  currencyCode: string;
  compareAtAmount?: number;
  startsAt?: boolean;
}>;

export type TrackingPageRecommendation = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  href?: string;
  price?: TrackingPageMoney;
};

/** Host callback for page-level recommendations, independent of tracking queries. */
export type TrackingPageRecommendationsQuery = () => Promise<TrackingPageRecommendation[]>;
export type TrackingPageRecommendationsState = {
  phase: TrackingPageRuntimePhase;
  items: TrackingPageRecommendation[];
};

/** Dynamic merchant promotion returned by the trusted storefront host. */
export type TrackingPageAd = Readonly<{
  imageUrl: string;
  href?: string;
  alt?: string;
}>;

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
  /** City/region-level destination only. Never include a street address or contact data. */
  destination?: string;
  estimatedDelivery?: string;
  progress?: TrackingPageTrackingStep[];
  events?: TrackingPageTrackingEvent[];
  orderItems?: TrackingPageOrderItem[];
  recommendations?: TrackingPageRecommendation[];
  ad?: TrackingPageAd;
};

export type TrackingPageQueryResult = {
  /** `empty` is a successful query with no customer-visible tracking result. */
  outcome?: "found" | "empty";
  trackingNumber: string;
  status: string;
  carrier?: string;
  latestEvent?: string;
  updatedAt?: string;
  /** City/region-level destination only. Never include a street address or contact data. */
  destination?: string;
  transitDuration?: string;
  orderNumber?: string;
  estimatedDelivery?: string;
  progress?: TrackingPageTrackingStep[];
  events?: TrackingPageTrackingEvent[];
  orderItems?: TrackingPageOrderItem[];
  recommendations?: TrackingPageRecommendation[];
  ad?: TrackingPageAd;
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

/** Host-decided display state. This package never derives entitlement status. */
export type TrackingPageWatermark = Readonly<{
  visible: boolean;
  label?: string;
}>;

export type TrackingPageRuntimePhase = "idle" | "loading" | "success" | "empty" | "error";

/** PRD input rules; hosts must validate again before reaching any upstream. */
export function isValidTrackingNumber(value: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

export function isValidOrderNumber(value: string) {
  return /^\S{1,64}$/.test(value);
}

export function isValidOrderEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function isEmptyTrackingPageResult(result: TrackingPageQueryResult) {
  return result.outcome === "empty";
}

export function isTrackingPageResourceReference(value: unknown, kind?: TrackingPageResourceReference["kind"]): value is TrackingPageResourceReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<TrackingPageResourceReference>;
  return typeof candidate.id === "string" && candidate.id.startsWith("gid://shopify/") && (candidate.kind === "product" || candidate.kind === "collection" || candidate.kind === "media") && (kind === undefined || candidate.kind === kind);
}

export function formatTrackingPageMoney(value: TrackingPageMoney, locale = "en-US") {
  if (!Number.isInteger(value.amount) || !/^[A-Z]{3}$/.test(value.currencyCode)) return undefined;
  try {
    const amount = new Intl.NumberFormat(locale, { style: "currency", currency: value.currencyCode }).format(value.amount / 100);
    const compareAt = value.compareAtAmount !== undefined && Number.isInteger(value.compareAtAmount) && value.compareAtAmount > value.amount
      ? new Intl.NumberFormat(locale, { style: "currency", currency: value.currencyCode }).format(value.compareAtAmount / 100)
      : undefined;
    return { amount, compareAt, startsAt: value.startsAt === true };
  } catch {
    return undefined;
  }
}
