"use client";

import { TrackingRuntimeProvider } from "@standhigher/besttrack-page-extension";
import type { ReactNode } from "react";
import { studioAdExample } from "./studio-ad-example";

// 编辑画布只需要广告预览上下文；实际查单预览由 StudioDocument 注入查询和独立推荐回调。
export function StudioAdPreview({ children }: { children: ReactNode }) {
  return <TrackingRuntimeProvider adPreview={studioAdExample}>{children}</TrackingRuntimeProvider>;
}
