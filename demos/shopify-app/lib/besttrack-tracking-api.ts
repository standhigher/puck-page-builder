import { type BestTrackTrackingParams, type BestTrackTrackingResult, validateBestTrackTrackingParams } from "./besttrack-data-source";

export class BestTrackLiveDataError extends Error {
  constructor(public readonly status: number, public readonly reason: string) {
    super(reason);
    this.name = "BestTrackLiveDataError";
  }
}

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (typeof record[key] === "string" && record[key]) return record[key];
  return undefined;
}

function normalizeTrackingResponse(value: unknown, requestedTrackingNumber: string): BestTrackTrackingResult {
  const root = isRecord(value) ? value : null;
  const shipment = root && isRecord(root.data) ? root.data : root;
  if (!shipment) throw new BestTrackLiveDataError(502, "besttrack-invalid-response");

  const events = Array.isArray(shipment.events) ? shipment.events.filter(isRecord) : [];
  const latestEvent = events[0];
  const status = firstString(shipment, ["status", "trackingStatus", "tracking_status"]) ?? (latestEvent ? firstString(latestEvent, ["status", "description", "message"]) : undefined);
  if (!status) throw new BestTrackLiveDataError(502, "besttrack-invalid-response");
  const carrier = firstString(shipment, ["carrier", "carrierName", "carrier_name"]);
  const latestEventMessage = firstString(shipment, ["latestEvent", "latest_event", "message"]) ?? (latestEvent ? firstString(latestEvent, ["description", "message"]) : undefined);
  const updatedAt = firstString(shipment, ["updatedAt", "updated_at", "lastUpdated"]);

  return {
    trackingNumber: firstString(shipment, ["trackingNumber", "tracking_number", "number"]) ?? requestedTrackingNumber,
    status,
    ...(carrier ? { carrier } : {}),
    ...(latestEventMessage ? { latestEvent: latestEventMessage } : {}),
    ...(updatedAt ? { updatedAt } : {})
  };
}

export async function requestConfiguredBestTrackTracking(params: BestTrackTrackingParams, environment: NodeJS.ProcessEnv = process.env, fetchImpl: FetchLike = fetch): Promise<BestTrackTrackingResult> {
  const issues = validateBestTrackTrackingParams(params);
  if (issues.length > 0) throw new BestTrackLiveDataError(400, "invalid-tracking-number");

  const endpoint = environment.BESTTRACK_TRACKING_API_URL;
  const apiToken = environment.BESTTRACK_API_TOKEN;
  if (!endpoint || !apiToken) throw new BestTrackLiveDataError(503, "besttrack-live-data-not-configured");

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new BestTrackLiveDataError(503, "besttrack-live-data-not-configured");
  }
  url.searchParams.set("trackingNumber", params.trackingNumber);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    throw new BestTrackLiveDataError(error instanceof DOMException && error.name === "TimeoutError" ? 504 : 502, "besttrack-upstream-unavailable");
  }
  if (!response.ok) throw new BestTrackLiveDataError(502, "besttrack-upstream-rejected-request");

  try {
    return normalizeTrackingResponse(await response.json(), params.trackingNumber);
  } catch (error) {
    if (error instanceof BestTrackLiveDataError) throw error;
    throw new BestTrackLiveDataError(502, "besttrack-invalid-response");
  }
}
