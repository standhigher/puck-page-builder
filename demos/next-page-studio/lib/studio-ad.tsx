"use client";

import { ReadyToGoRuntimeProvider, type TrackingPageAd } from "@standhigher/besttrack-page-extension";
import type { ReactNode } from "react";

/**
 * Preview-only promotion. It is not stored in the page document.
 * The image is not 20:9, so the slot's fixed frame is visible.
 */
export const studioAdExample: TrackingPageAd = {
  imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
  href: "https://example.com/promo",
  alt: "Demo promotion"
};

export function StudioAdPreview({ children }: { children: ReactNode }) {
  return <ReadyToGoRuntimeProvider adPreview={studioAdExample}>{children}</ReadyToGoRuntimeProvider>;
}
