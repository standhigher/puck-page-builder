import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadyToGoRecommendationsBlock, ReadyToGoRuntimeProvider } from "./ready-to-go";
import { PackageContents } from "./track-page-display";

describe("Ready-to-go configured recommendations", () => {
  it("updates the shop symbol without changing saved product prices and falls back when cleared", () => {
    const products = [{ id: "gid://shopify/Product/1", title: "Travel tote", price: { amount: 1234, currencyCode: "BDT" } }];
    const preview = (currencySymbol?: string) => (
      <ReadyToGoRuntimeProvider currencySymbol={currencySymbol}>
        <ReadyToGoRecommendationsBlock products={products} />
      </ReadyToGoRuntimeProvider>
    );
    const { rerender } = render(preview());
    expect(screen.getByText("BDT 12.34")).toBeInTheDocument();
    rerender(preview("৳"));
    expect(screen.getByText("৳ 12.34")).toBeInTheDocument();
    rerender(preview(" "));
    expect(screen.getByText("BDT 12.34")).toBeInTheDocument();
    expect(products[0]!.price).toEqual({ amount: 1234, currencyCode: "BDT" });
  });

  it("turns a saved Shopify handle into a clickable storefront URL", () => {
    render(<ReadyToGoRecommendationsBlock heading="You may also like..." products={[{
      id: "gid://shopify/Product/1",
      title: "Travel tote",
      handle: "travel-tote"
    }]} />);

    expect(screen.getByRole("link", { name: /Travel tote/ }).getAttribute("href")).toBe(
      `${window.location.origin}/products/travel-tote`
    );
  });
});

describe("Package contents name", () => {
  it("keeps the truncated name and exposes the full name in a hover tooltip", () => {
    const title = "Selling Plans Ski Wax - Special Selling Plans Ski Wax - Special";
    render(<PackageContents items={[{ id: "wax", title, quantity: 1 }]} />);

    expect(screen.getByText(title, { selector: ".bt-package-name__text" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(title);
  });

  it("always shows Reorder next to quantity using the product path", () => {
    render(<PackageContents items={[{
      id: "gid://shopify/Product/1",
      title: "Tote",
      quantity: 1,
      href: "/products/1"
    }]} />);

    const reorder = screen.getByRole("link", { name: "Reorder" });
    expect(reorder).toHaveAttribute("href", `${window.location.origin}/products/1`);
    expect(reorder).toHaveClass("bt-package-reorder");
  });

  it("still shows Reorder when the item has no href", () => {
    render(<PackageContents items={[{ id: "wax", title: "Wax", quantity: 1 }]} />);

    expect(screen.getByRole("link", { name: "Reorder" })).toHaveAttribute("href", "/products/");
  });
});
