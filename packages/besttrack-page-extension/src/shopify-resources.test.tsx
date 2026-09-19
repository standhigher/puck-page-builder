import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolveShopifyResources, ShopifyCollectionResourceField, ShopifyResourcePickerProvider, type ShopifyResourceResolver } from "./shopify-resources";

describe("Shopify resource picker and Runtime contract", () => {
  it("validates references before resolution and never substitutes mock data after a live failure", async () => {
    const resolve = vi.fn<ShopifyResourceResolver["resolve"]>().mockResolvedValue([{ id: "gid://shopify/Product/1", kind: "product", title: "Travel case", status: "resolved", availability: "available", href: "javascript:unsafe" }]);
    const resolver: ShopifyResourceResolver = { resolve };
    const result = await resolveShopifyResources([
      { id: "gid://shopify/Product/1", kind: "product", title: "Travel case" },
      { id: "not-a-gid", kind: "product", title: "Broken" },
      { id: "gid://shopify/Collection/1", kind: "collection", title: "Featured" }
    ], resolver);

    expect(resolve).toHaveBeenCalledWith({ references: [
      { id: "gid://shopify/Product/1", kind: "product", title: "Travel case" },
      { id: "gid://shopify/Collection/1", kind: "collection", title: "Featured" }
    ] });
    expect(result.resources["product:gid://shopify/Product/1"]).toMatchObject({ title: "Travel case", availability: "available" });
    expect(result.resources["product:gid://shopify/Product/1"]?.href).toBeUndefined();
    expect(result.errors).toMatchObject({ "invalid:1": { code: "invalid-reference" }, "collection:gid://shopify/Collection/1": { code: "missing" } });

    const unavailable = await resolveShopifyResources([{ id: "gid://shopify/Product/2", kind: "product", title: "Unavailable" }], { async resolve() { throw new Error("live upstream failed"); } });
    expect(unavailable.resources).toEqual({});
    expect(unavailable.errors).toEqual({ "product:gid://shopify/Product/2": { code: "resolution-failed" } });
  });

  it("delegates collection browsing, search, and pagination to the injected host browser", async () => {
    const search = vi.fn().mockResolvedValue({ items: [{ id: "gid://shopify/Collection/2", kind: "collection", title: "New arrivals", handle: "new-arrivals" }] });
    const onChange = vi.fn();
    render(<ShopifyResourcePickerProvider browser={{ search }}><ShopifyCollectionResourceField value={undefined} onChange={onChange} /></ShopifyResourcePickerProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Select collection" }));
    expect(await screen.findByText("New arrivals")).not.toBeNull();
    await waitFor(() => expect(search).toHaveBeenCalledWith({ kinds: ["collection"], query: "", limit: 20 }));
    fireEvent.click(screen.getByRole("button", { name: /new arrivals/i }));
    expect(onChange).toHaveBeenCalledWith({ id: "gid://shopify/Collection/2", kind: "collection", title: "New arrivals", handle: "new-arrivals" });
  });
});
