import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadyToGoRecommendationsBlock } from "./ready-to-go";

describe("Ready-to-go configured recommendations", () => {
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
