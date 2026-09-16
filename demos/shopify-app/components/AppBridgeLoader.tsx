"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AppBridgeStatus = "standalone" | "loading" | "ready" | "failed";
const AppBridgeContext = createContext<AppBridgeStatus>("loading");
const appBridgeUrl = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

export function AppBridgeLoader({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppBridgeStatus>("loading");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const isEmbeddedShopifyRequest = Boolean(search.get("shop") && search.get("host"));

    // `pnpm dev` opens a standalone local preview. App Bridge receives its
    // configuration from the Shopify Admin iframe, so loading it here would
    // fail with "missing required configuration fields: shop".
    if (!isEmbeddedShopifyRequest) {
      document.querySelector<HTMLScriptElement>('script[data-besttrack-app-bridge="true"]')?.remove();
      queueMicrotask(() => setStatus("standalone"));
      return;
    }

    if ("shopify" in window) {
      queueMicrotask(() => setStatus("ready"));
      return;
    }

    let existing = document.querySelector<HTMLScriptElement>('script[data-besttrack-app-bridge="true"]');
    // A dynamic script is async by default. App Bridge rejects that mode, so
    // discard the earlier development-mode script if one is still present.
    if (existing?.async) {
      existing.remove();
      existing = null;
    }

    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (!("shopify" in window)) {
        setStatus("failed");
        return;
      }

      void shopify.ready.then(() => setStatus("ready")).catch(() => setStatus("failed"));
    };
    const onError = () => setStatus("failed");

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (!existing) {
      // Must be set before appending: dynamically created scripts are async by
      // default, but App Bridge requires an ordered, non-async script tag.
      script.async = false;
      script.src = appBridgeUrl;
      script.dataset.besttrackAppBridge = "true";
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, []);

  return <AppBridgeContext.Provider value={status}>{children}</AppBridgeContext.Provider>;
}

export function useAppBridgeStatus() {
  return useContext(AppBridgeContext);
}
