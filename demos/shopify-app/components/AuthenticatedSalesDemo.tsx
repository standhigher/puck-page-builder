"use client";

import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback } from "react";
import { SalesDemo } from "./SalesDemo";

export function AuthenticatedSalesDemo() {
  const shopify = useAppBridge();
  const getSessionToken = useCallback(() => shopify.idToken(), [shopify]);
  return <SalesDemo getSessionToken={getSessionToken} />;
}
