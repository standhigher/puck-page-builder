"use client";

import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback } from "react";
import { ReadyToGoDemo } from "./ReadyToGoDemo";

export function AuthenticatedReadyToGoDemo() {
  const shopify = useAppBridge();
  const getSessionToken = useCallback(() => shopify.idToken(), [shopify]);
  return <ReadyToGoDemo getSessionToken={getSessionToken} />;
}
