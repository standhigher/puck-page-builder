"use client";

import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback } from "react";
import { BrandedDemo } from "./BrandedDemo";

export function AuthenticatedBrandedDemo() {
  const shopify = useAppBridge();
  const getSessionToken = useCallback(() => shopify.idToken(), [shopify]);
  return <BrandedDemo getSessionToken={getSessionToken} />;
}
