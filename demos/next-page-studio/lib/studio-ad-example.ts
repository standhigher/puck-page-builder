import type { TrackingPageAd } from "@standhigher/besttrack-page-extension";

/**
 * 仅供编辑与预览使用的广告数据，通过 Runtime 注入，不写入 PageDocument。
 * 从客户端 Provider 包装组件中拆出纯数据，供不同预览入口复用；本文件不需要客户端指令。
 * 示例图片本身不是 20:9，用来观察广告容器固定比例下的裁切效果。
 */
export const studioAdExample: TrackingPageAd = {
  imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
  href: "https://example.com/promo",
  alt: "Demo promotion"
};
