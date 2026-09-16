"use client";

import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback } from "react";
import { BestTrackLiveDataDemo } from "./BestTrackLiveDataDemo";

export function AuthenticatedBestTrackLiveDataDemo() {
  const shopify = useAppBridge();
  const getSessionToken = useCallback(() => shopify.idToken(), [shopify]);
  return <BestTrackLiveDataDemo getSessionToken={getSessionToken} />;
}
