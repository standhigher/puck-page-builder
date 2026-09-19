"use client";

import type { ShopifyResolvedResource, ShopifyResourceBrowser, ShopifyResourceReference, ShopifyResourceResolver, ShopifyResourceSearchInput, ShopifyResourceSearchPage } from "@standhigher/besttrack-page-extension";
import type { GetSessionToken } from "./besttrack-data-source";

async function authorizedRequest(getSessionToken: GetSessionToken, input: RequestInfo | URL, init?: RequestInit) {
  const token = await getSessionToken();
  const response = await fetch(input, { ...init, headers: { ...init?.headers, authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`shopify-resource-host-${response.status}`);
  return response;
}

export function createShopifyResourceBrowser(getSessionToken: GetSessionToken): ShopifyResourceBrowser {
  return {
    async search(input: ShopifyResourceSearchInput): Promise<ShopifyResourceSearchPage> {
      const params = new URLSearchParams({ kinds: input.kinds.join(","), query: input.query, limit: String(input.limit) });
      if (input.cursor) params.set("cursor", input.cursor);
      return await (await authorizedRequest(getSessionToken, `/api/shopify/resources?${params}`)).json() as ShopifyResourceSearchPage;
    }
  };
}

export function createShopifyResourceResolver(getSessionToken: GetSessionToken): ShopifyResourceResolver {
  return {
    async resolve({ references }: { references: readonly ShopifyResourceReference[] }): Promise<readonly ShopifyResolvedResource[]> {
      const response = await authorizedRequest(getSessionToken, "/api/shopify/resources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ references }) });
      const body = await response.json() as { resources?: unknown };
      if (!Array.isArray(body.resources)) throw new Error("shopify-resource-host-invalid-response");
      return body.resources as ShopifyResolvedResource[];
    }
  };
}
