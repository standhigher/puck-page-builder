import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrandedQueryBlock, BrandedRuntimeProvider } from "./branded";
import { SalesQueryBlock, SalesRuntimeProvider } from "./sales";
import type { TrackingPageQuery } from "./tracking-page-runtime";

describe("discriminated query cards", () => {
  it("keeps Branded order fields and sends an order-and-email request", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "ORDER-2048", status: "In transit" });
    render(<BrandedRuntimeProvider query={query}><BrandedQueryBlock heading="Track" submitLabel="Find" /></BrandedRuntimeProvider>);
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "ORDER-2048" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "customer@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    await waitFor(() => expect(query).toHaveBeenCalledWith({ mode: "order", orderNumber: "ORDER-2048", email: "customer@example.test" }));
    expect(screen.getByTestId("branded-result").textContent).toContain("Current status: In transit");
  });

  it("shows Sales local validation, preserves tab input, and replaces the in-card result", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-2048", status: "Delivered", latestEvent: "Left at the front door" });
    render(<SalesRuntimeProvider query={query}><SalesQueryBlock heading="Track" submitLabel="Find" /></SalesRuntimeProvider>);
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(screen.getAllByRole("alert").map((element) => element.textContent)).toEqual(expect.arrayContaining([
      "Enter a valid order number.",
      "Enter a valid email address."
    ]));
    fireEvent.click(screen.getByRole("tab", { name: "Tracking Number" }));
    fireEvent.change(screen.getByLabelText("Sales tracking number"), { target: { value: "BT-2048" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    await waitFor(() => expect(query).toHaveBeenCalledWith({ mode: "tracking", trackingNumber: "BT-2048" }));
    expect(screen.getByTestId("sales-result").textContent).toContain("Delivered");
  });
});
