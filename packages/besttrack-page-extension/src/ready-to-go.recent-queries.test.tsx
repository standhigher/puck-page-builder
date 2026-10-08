import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ReadyToGoDeliveryBlock,
  ReadyToGoProgressBlock,
  ReadyToGoQueryBlock,
  ReadyToGoRuntimeProvider
} from "./ready-to-go";
import type { TrackingPageQuery, TrackingPageQueryResult } from "./tracking-page-runtime";

function resultFor(trackingNumber: string, extra: Partial<TrackingPageQueryResult> = {}): TrackingPageQueryResult {
  return {
    trackingNumber,
    status: `Status ${trackingNumber}`,
    carrier: `Carrier ${trackingNumber}`,
    ...extra
  };
}

// 用实际查询、进度、配送区块组合验证联动，避免仅测试 Runtime 状态而漏掉界面接线。
function renderPage(query: TrackingPageQuery) {
  return render(
    <ReadyToGoRuntimeProvider query={query}>
      <ReadyToGoQueryBlock submitLabel="Track Your Order" />
      <ReadyToGoProgressBlock />
      <ReadyToGoDeliveryBlock />
    </ReadyToGoRuntimeProvider>
  );
}

async function searchTracking(trackingNumber: string) {
  fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: trackingNumber } });
  fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
  await waitFor(() => {
    expect(screen.getByText(`Status ${trackingNumber}`).textContent).toBe(`Status ${trackingNumber}`);
  });
}

describe("Ready-to-go recent query badges", () => {
  it("shows a single tracking number as text, then the newest three as badges", async () => {
    const query = vi.fn<TrackingPageQuery>(async (request) => {
      if (request.mode !== "tracking") throw new Error("expected tracking");
      return resultFor(request.trackingNumber);
    });
    renderPage(query);

    await searchTracking("AAA");
    expect(screen.getByText("Tracking: AAA").textContent).toBe("Tracking: AAA");
    expect(screen.queryByRole("button", { name: "AAA" })).toBeNull();

    await searchTracking("BBB");
    expect(screen.getByRole("button", { name: "BBB" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "AAA" }).getAttribute("aria-pressed")).toBe("false");

    await searchTracking("CCC");
    // 第四次成功查询淘汰最旧标识；上限约束查询记录，不约束每条记录内的包裹数量。
    await searchTracking("DDD");

    expect(screen.getByRole("button", { name: "DDD" }).textContent).toBe("DDD");
    expect(screen.getByRole("button", { name: "CCC" }).textContent).toBe("CCC");
    expect(screen.getByRole("button", { name: "BBB" }).textContent).toBe("BBB");
    expect(screen.queryByRole("button", { name: "AAA" })).toBeNull();
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("restores a cached result from a badge without querying again", async () => {
    const query = vi.fn<TrackingPageQuery>(async (request) => {
      if (request.mode !== "tracking") throw new Error("expected tracking");
      return resultFor(request.trackingNumber);
    });
    renderPage(query);

    await searchTracking("AAA");
    await searchTracking("BBB");
    expect(query).toHaveBeenCalledTimes(2);

    // 同时核对进度、配送与输入回填，末尾的调用次数保证恢复走缓存而未重新请求。
    fireEvent.click(screen.getByRole("button", { name: "AAA" }));
    expect(screen.getByText("Status AAA").textContent).toBe("Status AAA");
    expect(screen.getByText("Carrier AAA").textContent).toBe("Carrier AAA");
    expect((screen.getByLabelText("Tracking number") as HTMLInputElement).value).toBe("AAA");
    expect(screen.getByRole("button", { name: "AAA" }).getAttribute("aria-pressed")).toBe("true");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("replaces the recent list when the query mode changes", async () => {
    const query = vi.fn<TrackingPageQuery>(async (request) => {
      if (request.mode === "tracking") return resultFor(request.trackingNumber);
      return {
        ...resultFor(request.orderNumber),
        trackingNumber: request.orderNumber,
        orderNumber: request.orderNumber
      };
    });
    renderPage(query);

    await searchTracking("AAA");
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "ORDER-1" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    await waitFor(() => {
      expect(screen.getByText("Status ORDER-1").textContent).toBe("Status ORDER-1");
    });

    expect(screen.getByText("Order: ORDER-1").textContent).toBe("Order: ORDER-1");
    expect(screen.queryByRole("button", { name: "AAA" })).toBeNull();
  });

  it("switches a multi-shipment result with the same badge style", async () => {
    // 故意使用运单号查询返回两个包裹：第二层取决于结果数量，不能被限定为订单号模式。
    const query = vi.fn<TrackingPageQuery>(async () => resultFor("AAA", {
      shipments: [
        { id: "s1", label: "AAA", trackingNumber: "AAA", status: "Status AAA", carrier: "Carrier AAA" },
        { id: "s2", label: "SHIP-2", trackingNumber: "SHIP-2", status: "Status SHIP-2", carrier: "Carrier SHIP-2" }
      ]
    }));
    renderPage(query);

    await searchTracking("AAA");
    fireEvent.click(screen.getByRole("button", { name: "SHIP-2" }));
    expect(screen.getByText("Status SHIP-2").textContent).toBe("Status SHIP-2");
    expect(screen.getByText("Carrier SHIP-2").textContent).toBe("Carrier SHIP-2");
    expect(screen.getByRole("button", { name: "SHIP-2" }).getAttribute("aria-pressed")).toBe("true");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
