import type { ProductPickerAdapter, ProductReference } from "@standhigher/puck-page-builder";

const studioDemoProducts: ProductReference[] = [
  { id: "gid://shopify/Product/101", title: "Studio Wireless Headphones", imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80", handle: "studio-wireless-headphones" },
  { id: "gid://shopify/Product/102", title: "Cloud Buds Pro", imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=200&q=80", handle: "cloud-buds-pro" },
  { id: "gid://shopify/Product/103", title: "Compact Mechanical Keyboard", imageUrl: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=200&q=80", handle: "compact-mechanical-keyboard" },
  { id: "gid://shopify/Product/104", title: "Travel tote", imageUrl: "https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=200&q=80", handle: "travel-tote" }
];

/** Demo-only picker. Production hosts should open Shopify's resource picker. */
export const studioProductPicker: ProductPickerAdapter = {
  async selectProducts({ current }) {
    return current.length ? current : studioDemoProducts;
  }
};
