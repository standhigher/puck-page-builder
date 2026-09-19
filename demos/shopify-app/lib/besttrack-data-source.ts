import type { DataSourceDefinition, ValidationIssue } from "@standhigher/puck-page-builder/extensions";

export type BestTrackTrackingParams = {
  trackingNumber: string;
};

export type BestTrackTrackingResult = {
  trackingNumber: string;
  status: string;
  carrier?: string;
  latestEvent?: string;
  updatedAt?: string;
};

export type GetSessionToken = () => Promise<string>;

export function validateBestTrackTrackingParams(params: unknown): ValidationIssue[] {
  if (!params || typeof params !== "object" || Array.isArray(params)) return [{ path: "params", message: "物流查询参数必须是对象" }];
  const trackingNumber = (params as Record<string, unknown>).trackingNumber;
  if (typeof trackingNumber !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(trackingNumber)) {
    return [{ path: "params.trackingNumber", message: "trackingNumber 必须是 6–64 位的字母、数字、连字符或下划线" }];
  }
  return [];
}

function assertTrackingParams(params: unknown): asserts params is BestTrackTrackingParams {
  const issues = validateBestTrackTrackingParams(params);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join("；"));
}

/** Deterministic preview data only; it is never used as a live-data fallback. */
export async function mockBestTrackTracking(params: BestTrackTrackingParams): Promise<BestTrackTrackingResult> {
  assertTrackingParams(params);
  return {
    trackingNumber: params.trackingNumber,
    status: "In transit",
    carrier: "BestTrack demo carrier",
    latestEvent: "Mock shipment accepted",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

/**
 * Calls the demo's server-side proxy. The proxy keeps the BestTrack credential
 * out of the browser and verifies the Shopify embedded-session token first.
 */
export async function requestBestTrackLiveTracking(params: BestTrackTrackingParams, getSessionToken?: GetSessionToken): Promise<BestTrackTrackingResult> {
  assertTrackingParams(params);
  if (!getSessionToken) throw new Error("Live 物流数据只能在已认证的 Shopify 嵌入式应用中请求");

  const token = await getSessionToken();
  const query = new URLSearchParams({ trackingNumber: params.trackingNumber });
  const response = await fetch(`/api/besttrack/tracking?${query}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => null) as BestTrackTrackingResult | { reason?: string } | null;
  if (!response.ok || !body || !("trackingNumber" in body) || !("status" in body)) {
    throw new Error(body && "reason" in body && body.reason ? body.reason : "besttrack-live-request-failed");
  }
  return body;
}

export function createBestTrackTrackingDataSource(getSessionToken?: GetSessionToken): DataSourceDefinition<BestTrackTrackingParams, BestTrackTrackingResult> {
  return {
    key: "besttrack.tracking.query",
    mock: mockBestTrackTracking,
    live: (params) => requestBestTrackLiveTracking(params, getSessionToken),
    validateParams: validateBestTrackTrackingParams
  };
}
