"use client";

import { TrackingRuntimeProvider, type TrackingPageRecommendationsQuery, type TrackingPageQuery, type TrackingPageQueryResult } from "@standhigher/besttrack-page-extension";
import { WebRenderer, type PageDocument } from "@standhigher/puck-page-builder/runtime";
import { pageStudioRegistry } from "../lib/registry";
import { studioAdExample } from "../lib/studio-ad-example";

const DEMO_QUERY_NUMBERS = ["BT-2048-DEMO", "BT-2049-DEMO", "BT-2050-DEMO"] as const;

// 为三个演示号码提供不同状态，便于观察第一层历史记录恢复后，状态和承运商是否一起更新。
// 这些号码只是测试入口；实际的最近三条记录仍由 Runtime 在每次成功查询后生成。
const demoLookups: Record<string, Pick<TrackingPageQueryResult, "status" | "carrier" | "latestEvent">> = {
  "BT-2048-DEMO": {
    status: "In transit",
    carrier: "BestTrack North",
    latestEvent: "Shipment accepted at the regional hub"
  },
  "BT-2049-DEMO": {
    status: "Delivered",
    carrier: "BestTrack Express",
    latestEvent: "Left at the front door"
  },
  "BT-2050-DEMO": {
    status: "Out for Delivery",
    carrier: "BestTrack City",
    latestEvent: "With the local courier"
  }
};

function demoShipments(request: Parameters<TrackingPageQuery>[0], trackingNumber: string, lookup: Pick<TrackingPageQueryResult, "status" | "carrier" | "latestEvent">): TrackingPageQueryResult["shipments"] {
  // 这里只为 Demo 构造“订单号查到两个包裹、运单号查到一个包裹”的常见场景。
  // 公共显示规则并不限制查询模式：任何查询返回多个 shipments，都会提供第二层包裹切换。
  if (request.mode === "order") {
    return [
      { id: `${trackingNumber}-a`, label: `${trackingNumber}-A`, trackingNumber: `${trackingNumber}-A`, status: lookup.status, carrier: lookup.carrier, latestEvent: lookup.latestEvent },
      { id: `${trackingNumber}-b`, label: `${trackingNumber}-B`, trackingNumber: `${trackingNumber}-B`, status: "Out for Delivery", carrier: "BestTrack Local", latestEvent: "With the local courier" }
    ];
  }
  return [{ id: `demo-shipment-${trackingNumber}`, label: trackingNumber, trackingNumber, status: lookup.status, carrier: lookup.carrier, latestEvent: lookup.latestEvent }];
}

const mockQuery: TrackingPageQuery = async (request) => {
  // 同一演示入口支持两种请求形状；订单号在此用作模拟结果键，实际包裹编号由 demoShipments 构造。
  const trackingNumber = request.mode === "tracking" ? request.trackingNumber : request.orderNumber;
  // 未列入演示号码表的输入也返回演示结果，方便手动验证历史去重和第四条挤出最旧记录。
  // 此处没有发起网络请求，这个默认值不承担 Live 请求失败后的回退职责。
  const lookup = demoLookups[trackingNumber] ?? {
    status: "In transit",
    carrier: "BestTrack demo carrier",
    latestEvent: "Shipment accepted at the regional hub"
  };
  return {
    trackingNumber,
    status: lookup.status,
    carrier: lookup.carrier,
    latestEvent: lookup.latestEvent,
    updatedAt: "Sep 17, 10:00 AM",
    destination: "Shanghai",
    estimatedDelivery: "Sep 22 - Sep 24",
    shipments: demoShipments(request, trackingNumber, lookup),
    // 包裹没有单独提供商品或广告时，公共 Runtime 沿用本次结果级内容，便于检查区块联动。
    orderItems: [{ id: "demo-item", title: `Item for ${trackingNumber}`, quantity: 1, description: "Preview-only product information." }],
    ad: studioAdExample
  };
};

// 推荐由独立回调加载，预览页无需先查单即可展示；查单和包裹切换不重新加载推荐。
const mockRecommendationsQuery: TrackingPageRecommendationsQuery = async () => [{ id: "demo-recommendation", title: "Delivery alerts", description: "Receive an update at every milestone.", price: { amount: 400, currencyCode: "USD" } }];

/**
 * Studio 明确注入演示查询和推荐，所有模板区块共用下面同一份 Runtime 状态。
 * 三套模板的 Provider 名称已是同一组件的别名，无需按模板嵌套，否则会形成彼此隔离的状态。
 * previewAutoQuery 仅控制预览自动查询，既不预填三条历史，也不代表生产页面应自动查单。
 */
export function StudioDocument({ document, previewAutoQuery = false }: { document: PageDocument; previewAutoQuery?: boolean }) {
  // 按实际区块命名空间判断，因此复制出的自定义模板也能看到操作提示；提示本身不执行查询。
  const showRecentQueryHint = document.blocks.some((block) => ["besttrack.ready-to-go", "besttrack.branded", "besttrack.sales"].some((templateId) => block.type.startsWith(`${templateId}.`)));
  return <>
    {showRecentQueryHint ? <p style={{ margin: 0, padding: "10px 24px", background: "#f8fafc", color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
      连续查询 {DEMO_QUERY_NUMBERS.join("、")}，结果区会留下最近 3 条，点击可切换。
    </p> : null}
    <TrackingRuntimeProvider query={mockQuery} queryRecommendations={mockRecommendationsQuery} adPreview={studioAdExample} autoQueryDemo={previewAutoQuery}>
      <WebRenderer document={document} registry={pageStudioRegistry} />
    </TrackingRuntimeProvider>
  </>;
}
