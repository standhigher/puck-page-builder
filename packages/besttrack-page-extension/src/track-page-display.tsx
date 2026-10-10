/* eslint-disable react-refresh/only-export-components -- Shared visual primitives intentionally export components and token-aware helpers. */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import type { ReadyToGoOrderItem, ReadyToGoRecommendation, ReadyToGoTrackingEvent, ReadyToGoTrackingStep } from "./ready-to-go";
import type { TrackingPageAd } from "./tracking-page-runtime";
import { formatRecommendationPrice } from "./tracking-block-model";
// 默认进度算法已归到三模板共用模型；保留这个旧导出路径兼容现有引用。
export { defaultProgress } from "./tracking-block-model";
import { resolveShopifyRecommendHref } from "./shopify-track-query";
import { safeTrackingPageUrl } from "./tracking-page-url";

export const pageFont = { fontFamily: "var(--pb-font-family, Inter, system-ui, sans-serif)" } satisfies CSSProperties;
export const contentWidth = {
  width: "min(1248px, 100%)",
  margin: "0 auto",
  padding: "48px clamp(16px, 4%, 24px)",
  boxSizing: "border-box" as const
} satisfies CSSProperties;

const trackingProgressStyles = `
.bt-progress-band { container-type: inline-size; }
.bt-edd-card { --bt-progress-icon: 44px; }
.bt-progress { container-type: inline-size; }
.bt-progress__icon { width: 44px; height: 44px; }
.bt-progress__line { top: 19px; }
.bt-progress__copy { margin-top: 16px; }
.bt-progress__label { font-size: 16px; line-height: 20px; }
@container (max-width: 640px) {
  .bt-edd-card { --bt-progress-icon: 32px; }
  .bt-progress__icon { width: 32px; height: 32px; }
  .bt-progress__line { top: 13px; }
  .bt-progress__copy { margin-top: 8px; }
  .bt-progress__label { font-size: 11px; line-height: 14px; }
}
`;

// 名称本身必须裁成单行，完整文案只能放在同级弹层里，否则会被 overflow 裁掉。
const packageNameStyles = `
.bt-package-name { position: relative; width: 100%; max-width: 100%; min-width: 0; outline: none; }
.bt-package-name__text { display: block; width: 100%; max-width: 100%; margin: 0; overflow: hidden; font-size: 14px; font-weight: 500; color: #1e293b; text-overflow: ellipsis; white-space: nowrap; }
.bt-package-name__tooltip { position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 30; width: max-content; max-width: min(320px, calc(100vw - 48px)); padding: 8px 10px; border-radius: 6px; background: #0f172a; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18); color: #fff; font-size: 12px; font-weight: 500; line-height: 1.35; opacity: 0; overflow-wrap: anywhere; pointer-events: none; transform: translateY(2px); transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease; visibility: hidden; white-space: normal; }
.bt-package-name:hover .bt-package-name__tooltip,
.bt-package-name:focus-within .bt-package-name__tooltip { opacity: 1; transform: translateY(0); visibility: visible; }
.bt-package-reorder { box-sizing: border-box; display: inline-flex; width: fit-content; height: 30px; flex-shrink: 0; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 16px; background: #fff; cursor: pointer; text-decoration: none; transition: border-color 0.15s; }
.bt-package-reorder:hover { border-color: #94a3b8; }
`;

export function text(props: Record<string, unknown>, key: string, fallback = "") {
  return typeof props[key] === "string" ? props[key] : fallback;
}

export function safeHref(value: unknown) {
  return safeTrackingPageUrl(value);
}

function packageReorderHref(href?: string) {
  return safeHref(href) ?? resolveShopifyRecommendHref(href) ?? "/products/";
}

export function safeImageUrl(value: unknown) {
  return safeTrackingPageUrl(value);
}

function StepIcon({ name, done }: { name: ReadyToGoTrackingStep["icon"]; done: boolean }) {
  const fill = done ? "#ffffff" : "currentColor";
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", "aria-hidden": true as const, style: { width: 24, height: 24, display: "block" } };
  if (name === "bag") {
    return <svg {...common}><path fill={fill} d="M9.9 12.9c0-.239.095-.468.264-.636A.9.9 0 0 1 10.8 12h2.4a.9.9 0 1 1 0 1.8h-2.4a.9.9 0 0 1-.9-.9Z" /><path fill={fill} fillRule="evenodd" d="M6.3 4.2a2.1 2.1 0 0 0-2.1 2.1v2.4c0 .714.357 1.344.9 1.723V16.5a3.3 3.3 0 0 0 3.3 3.3h7.2a3.3 3.3 0 0 0 3.3-3.3v-6.077c.543-.379.9-1.009.9-1.723V6.3a2.1 2.1 0 0 0-2.1-2.1H6.3Zm10.8 6.6H6.9V16.5a1.5 1.5 0 0 0 1.5 1.5h7.2a1.5 1.5 0 0 0 1.5-1.5V10.8ZM6 6.3c0-.08.032-.156.088-.212A.3.3 0 0 1 6.3 6h11.4a.3.3 0 0 1 .3.3v2.4a.3.3 0 0 1-.3.3H6.3a.3.3 0 0 1-.3-.3V6.3Z" /></svg>;
  }
  if (name === "truck") {
    return <svg {...common}><path fill={fill} fillRule="evenodd" d="M4.8 6.3c0-.239.095-.468.264-.636A.9.9 0 0 1 5.7 5.4h8.389a3.3 3.3 0 0 1 3.174 2.394l.512 1.793a.6.6 0 0 0 .216.207l2.017.505A2.7 2.7 0 0 1 21.6 12.337V13.8a2.1 2.1 0 0 1-1.238 1.916 3.6 3.6 0 0 1-3.012 3.474 3.6 3.6 0 0 1-4.564-2.29H10.8a3.6 3.6 0 0 1-6.75-.903A3.6 3.6 0 0 1 5.05 15H4.5a.9.9 0 0 1 0-1.8h3a2.7 2.7 0 0 1 2.442 1.5h7.758A3.58 3.58 0 0 1 19.54 14.1a.45.45 0 0 0 .26-.198V12.336a.3.3 0 0 0-.228-.29l-2.018-.504a2.7 2.7 0 0 1-1.56-1.46l-.512-1.793A1.5 1.5 0 0 0 14.09 7.2H5.7a.9.9 0 0 1-.9-.9Zm3 11.1a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm9.6 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z" /><path fill={fill} d="M3.9 9.6a.9.9 0 0 0 0 1.8h6a.9.9 0 0 0 0-1.8h-6Z" /></svg>;
  }
  if (name === "box") {
    return <svg {...common}><path fill={fill} d="M15.995 5.672a1.05 1.05 0 1 0-1.39-1.578l-3.43 4.164-1.126-1.691a1.05 1.05 0 1 0-1.726 1.2l1.576 2.364a1.35 1.35 0 0 0 2.175.096l3.943-4.555Z" /><path fill={fill} fillRule="evenodd" d="M5.832 8.26a1.05 1.05 0 0 1 1.221 1.353L6.187 12H9.168a1.65 1.65 0 0 1 1.422 1.026l.191.569a.3.3 0 0 0 .284.205h1.87a.3.3 0 0 0 .284-.204l.191-.57A1.65 1.65 0 0 1 14.832 12H17.813l-.403-2.718a1.05 1.05 0 0 1 1.78-.837 1.05 1.05 0 0 1 .355 1.152L19.686 12.37c.076.51.114 1.023.114 1.538V15.9a3.9 3.9 0 0 1-3.9 3.9H8.1a3.9 3.9 0 0 1-3.9-3.9v-1.992c0-.516.038-1.029.113-1.54l.497-3.35a1.05 1.05 0 0 1 1.022-.828ZM6 13.908V13.8h2.952l.12.364a2.1 2.1 0 0 0 1.992 1.436h1.872a2.1 2.1 0 0 0 1.992-1.436l.12-.364H18v2.1a1.8 1.8 0 0 1-1.8 1.8H8.1A1.8 1.8 0 0 1 6 15.9v-1.992Z" /></svg>;
  }
  return <svg {...common}><path fill={fill} fillRule="evenodd" d="M18.852 6.187a1.05 1.05 0 0 1 .154 1.264l-8.161 10.63a1.35 1.35 0 0 1-2.177.081L4.99 13.444a1.05 1.05 0 0 1 1.431-1.534l3.188 4.176 7.98-10.187a1.05 1.05 0 0 1 1.263-.712Z" /></svg>;
}

export function ProductImage({ src, alt, size = 60 }: { src?: string; alt: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeImageUrl(src);
  const box: CSSProperties = {
    width: size,
    height: size,
    flex: "0 0 auto",
    borderRadius: "var(--pb-radius, 8px)",
    objectFit: "contain",
    background: "#fff"
  };
  if (!safeSrc || failed) {
    return <span aria-label={alt + " image unavailable"} style={{ ...box, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 12 }}>{alt.slice(0, 1).toUpperCase()}</span>;
  }
  return <img src={safeSrc} alt={alt} onError={() => setFailed(true)} style={box} />;
}

const hexColor = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const defaultProgressColor = "#0f172a";

function progressColor(value?: string) {
  return value && hexColor.test(value) ? value : defaultProgressColor;
}

export function TrackingProgress({ steps, color }: { steps: ReadyToGoTrackingStep[]; color?: string }) {
  const active = progressColor(color);
  const cells = Math.max(steps.length, 1);
  return <div className="bt-progress" role="region" aria-label="Delivery progress" style={{ marginTop: 32, width: "100%", maxWidth: 1200, marginLeft: "auto", marginRight: "auto", overflow: "visible" }}>
    <style>{trackingProgressStyles}</style>
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))`, columnGap: 4, width: "100%", alignItems: "start" }}>
      {cells > 1 ? <div className="bt-progress__line" aria-hidden="true" style={{ position: "absolute", left: `calc(50% / ${cells})`, right: `calc(50% / ${cells})`, height: 6, display: "flex", zIndex: 0, pointerEvents: "none" }}>
        {steps.slice(0, -1).map((step, index) => {
          const done = step.state === "complete" || step.state === "current";
          const nextDone = steps[index + 1]?.state === "complete" || steps[index + 1]?.state === "current";
          return <span key={step.id + "-line"} style={{ flex: 1, height: 6, borderRadius: 999, background: done && nextDone ? active : `color-mix(in srgb, ${active} 25%, transparent)` }} />;
        })}
      </div> : null}
      {steps.map((step, index) => {
        const done = step.state === "complete" || step.state === "current";
        return <div key={step.id} style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
          <span className="bt-progress__icon" aria-label={step.label + " " + step.state} style={{ display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 9999, border: `1px solid ${active}`, background: done ? active : "#fff", color: active }}>
            <StepIcon name={step.icon ?? (index === 0 || index === steps.length - 1 ? "check" : index === 1 ? "bag" : index === 2 ? "truck" : "box")} done={done} />
          </span>
          <div className="bt-progress__copy" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", textAlign: "center", padding: "0 2px" }}>
            <p className="bt-progress__label" style={{ margin: 0, fontWeight: 500, color: "#334155", overflowWrap: "anywhere", wordBreak: "break-word" }}>{step.label}</p>
            {step.date ? <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: "16px", color: "#94a3b8", overflowWrap: "anywhere" }}>{step.date}</p> : null}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

export function ShippingTimeline({ events }: { events: ReadyToGoTrackingEvent[] }) {
  if (!events.length) {
    return <p style={{ margin: "16px 0 0", color: "#475569", fontSize: 14 }}>Shipping events will appear when the carrier publishes them.</p>;
  }
  return <div aria-label="Shipping events" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>
    {events.map((event, index) => {
      const latest = event.state === "current" || index === 0;
      return <div key={event.id} style={{ position: "relative", paddingLeft: 28, paddingBottom: index < events.length - 1 ? 20 : 0 }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 2, width: 16, height: 16, borderRadius: 9999, background: latest ? "#16a34a" : "#cbd5e1" }} />
        {index < events.length - 1 ? <span aria-hidden="true" style={{ position: "absolute", left: 7, top: 20, width: 1, height: "100%", background: "#e2e8f0" }} /> : null}
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: latest ? "#c01400" : "#64748b" }}>{event.title}{event.detail ? ", " + event.detail : ""}</p>
        {event.at ? <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.5, color: latest ? "rgba(192, 20, 0, 0.8)" : "#94a3b8" }}>{event.at}</p> : null}
      </div>;
    })}
  </div>;
}

export function PackageContents({ items }: { items: ReadyToGoOrderItem[] }) {
  if (!items.length) return <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Package contents are not available for this shipment.</p>;
  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <style>{packageNameStyles}</style>
    {items.map((item) => {
      const title = item.title;
      return <article key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", overflow: "visible" }}>
        <ProductImage src={item.imageUrl} alt={title} />
        <div style={{ flex: 1, minWidth: 0, overflow: "visible" }}>
          <div className="bt-package-name" tabIndex={0} aria-label={title}>
            <p className="bt-package-name__text">{title}</p>
            <span className="bt-package-name__tooltip" role="tooltip">{title}</span>
          </div>
          {item.description ? <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{item.description}</p> : null}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>x{item.quantity}</p>
            <a href={packageReorderHref(item.href)} className="bt-package-reorder">Reorder</a>
          </div>
        </div>
      </article>;
    })}
  </div>;
}

/**
 * Ready-to-go 保留轮播交互，Branded/Sales 可使用自己的网格；商品选择由调用方共用模型完成。
 * 这里仅接收最终列表，并复用统一价格格式，避免展示组件把查单数据误当作推荐来源。
 */
export function RecommendationCards({ items }: { items: ReadyToGoRecommendation[] }) {
  // 保留 Ready-to-go 的轮播规则：每 3 秒前进一项，悬停暂停；拖动或点击不会永久关闭自动播放。
  // 插件实例在挂载期间保持稳定，避免商品或查询状态重渲染时重建计时器。
  const autoplay = useMemo(() => Autoplay({ delay: 3000, stopOnInteraction: false, stopOnMouseEnter: true }), []);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start", slidesToScroll: 1 }, [autoplay]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [hideButtons, setHideButtons] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    // 商品数量/容器尺寸可能触发重算，不能只在点击箭头时更新可滚动状态。
    // 首帧及 select/reInit 都向 Embla 取实际能力；商品不足以滚动时不显示无效箭头。
    const frame = window.requestAnimationFrame(onSelect);
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      window.cancelAnimationFrame(frame);
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    // 窄屏只隐藏两侧箭头，轮播拖动及自动播放仍保留；窗口跨过断点时同步更新。
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => setHideButtons(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (items.length === 0) return null;

  const arrow = (points: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
  const buttonStyle: CSSProperties = {
    position: "absolute",
    top: 115,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 99,
    border: 0,
    background: "#fff",
    boxShadow: "0 0 0.5px rgba(0, 0, 0, 0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#333",
    padding: 0
  };

  return <div aria-label="Recommended products carousel" style={{ position: "relative", marginLeft: "min(48px, 4%)", marginRight: "min(48px, 4%)" }}>
    {!hideButtons && canScrollPrev ? <button type="button" aria-label="Previous" onClick={() => emblaApi?.scrollPrev()} style={{ ...buttonStyle, left: -40 }}>{arrow("15 18 9 12 15 6")}</button> : null}
    <div ref={emblaRef} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex" }}>
        {items.map((item) => {
          const href = safeHref(item.href);
          const displayPrice = formatRecommendationPrice(item.price);
          const card = <>
            <div style={{ width: 262, height: 262, maxWidth: "100%", borderRadius: 8, border: "1px solid #E3E3E3", overflow: "hidden", background: "#fff" }}>
              <ProductImage src={item.imageUrl} alt={item.title} size={262} />
            </div>
            <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 14 }}>
              <p style={{ margin: 0, color: "#334155" }}>{item.title}</p>
              {displayPrice ? <p style={{ margin: "4px 0 0", fontWeight: 600, color: "#0f172a" }}>{displayPrice}</p> : null}
              {item.description ? <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{item.description}</p> : null}
            </div>
          </>;
          return <div key={item.id} style={{ flex: "0 0 286px", minWidth: 0, paddingRight: 24, boxSizing: "border-box" }}>
            {href ? <a href={href} style={{ display: "block", width: 262, maxWidth: "100%", textDecoration: "none", color: "inherit" }}>{card}</a> : <div style={{ width: 262, maxWidth: "100%" }}>{card}</div>}
          </div>;
        })}
      </div>
    </div>
    {!hideButtons && canScrollNext ? <button type="button" aria-label="Next" onClick={() => emblaApi?.scrollNext()} style={{ ...buttonStyle, right: -40 }}>{arrow("9 18 15 12 9 6")}</button> : null}
  </div>;
}

/**
 * Legacy Track Page `bst-ad-placeholder`: the slot is always 20:9 and at most
 * 500px wide. The image is taken out of flow and stretched to that box
 * (`object-fit: fill`), matching `.bst-ad-placeholder__img`. An in-flow image
 * would keep its own ratio and leave side gaps inside the column.
 */
const trackingPageAdSlotStyle: CSSProperties = {
  position: "relative",
  display: "block",
  width: "100%",
  maxWidth: 500,
  aspectRatio: "20 / 9",
  borderRadius: 8,
  overflow: "hidden",
  textDecoration: "none"
};
const trackingPageAdImageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "fill",
  objectPosition: "center"
};

export function TrackingPageAdSlot({ ad, disableLink = false }: { ad?: TrackingPageAd; disableLink?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const imageUrl = safeImageUrl(ad?.imageUrl);
  if (!imageUrl || failedUrl === imageUrl) return null;

  const content = (
    <img src={imageUrl} alt={ad?.alt ?? "Promotion"} loading="lazy" onError={() => setFailedUrl(imageUrl)} style={trackingPageAdImageStyle} />
  );

  const href = safeHref(ad?.href);
  if (!href || disableLink) return <div data-tracking-page-ad style={trackingPageAdSlotStyle}>{content}</div>;
  return <a data-tracking-page-ad href={href} target="_blank" rel="noopener noreferrer" style={trackingPageAdSlotStyle}>{content}</a>;
}

/** Original Track Page `bst-edd-card`. Width matches the progress icons, from the outer edge of the first step to the outer edge of the last. */
export function EstimatedDeliveryCard({ dateText, steps = 5 }: { dateText: string; steps?: number }) {
  const trackInset = `max(0px, calc(50% / ${Math.max(steps, 1)} - var(--bt-progress-icon, 44px) / 2))`;
  return <div aria-label="Est. Delivery" className="bt-edd-card" style={{ margin: `16px ${trackInset} 0`, width: "auto", boxSizing: "border-box", border: "1px solid transparent", borderRadius: 10, backgroundColor: "#eaf4ff", padding: "20px 22px 18px", textAlign: "left" }}>
    <p style={{ margin: 0, color: "#202124", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>Est. Delivery</p>
    <p style={{ margin: "6px 0 0", color: "#202124", fontSize: 22, fontWeight: 700, lineHeight: 1.15, letterSpacing: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>{dateText}</p>
    <p style={{ margin: "6px 0 0", color: "#5f6368", fontSize: 13, fontWeight: 400, lineHeight: 1.35 }}>Estimated time may update as tracking progresses.</p>
  </div>;
}

/** 沿用原 Track Page 的 `.bst-order-badges` / `.bst-order-badge` 外观。 */
const orderBadgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  margin: "0 auto"
};
const orderBadgeStyle = (active: boolean): CSSProperties => ({
  appearance: "none",
  height: 36,
  minWidth: 128,
  borderRadius: 8,
  border: `1px solid ${active ? "#c01400" : "#cbd5e1"}`,
  padding: "0 16px",
  font: "inherit",
  fontSize: 14,
  fontWeight: 600,
  color: active ? "#c01400" : "#64748b",
  background: "transparent",
  cursor: "pointer"
});

/**
 * 两层选择共用的纯展示按钮组：只报告点击索引，不发请求，也不持有选中状态。
 * 调用方分别传入历史恢复或包裹切换回调；三条上限属于历史层，不能在这里截断包裹列表。
 */
export function TrackPageOrderBadges({
  values,
  selectedIndex,
  onSelect,
  style
}: {
  values: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  style?: CSSProperties;
}) {
  if (values.length === 0) return null;
  return <div style={{ ...orderBadgeRowStyle, ...style }}>
    {values.map((value, index) => {
      const active = selectedIndex === index;
      return <button
        key={`${value}-${index}`}
        type="button"
        aria-pressed={active}
        onClick={() => onSelect(index)}
        style={orderBadgeStyle(active)}
      >{value}</button>;
    })}
  </div>;
}

/** 第一层只有一个查询标识时显示文本；mode 用于区分订单号/运单号文案，不控制包裹拆分。 */
export function TrackPageQueryNumber({ mode, value }: { mode: "tracking" | "order"; value: string }) {
  return <p style={{ margin: 0, fontSize: 20, fontWeight: 400, lineHeight: 1.4, color: "#000", overflowWrap: "anywhere" }}>
    {mode === "order" ? "Order" : "Tracking"}: {value}
  </p>;
}

export function SectionShell({ title, children, bordered = true, resultAnchor = false }: { title: string; children: ReactNode; bordered?: boolean; resultAnchor?: boolean }) {
  return <section aria-label={title} data-tracking-result={resultAnchor ? "" : undefined} style={{ ...pageFont, background: "var(--pb-color-background, #fff)", color: "var(--pb-color-text, #0f172a)", borderBottom: bordered ? "1px solid #f1f5f9" : "0" }}>{children}</section>;
}

export function IdleMessage({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, textAlign: "center", color: "var(--pb-color-muted, #64748b)" }}>{children}</p>;
}

export function SkeletonRow() {
  return <div className="bt-progress" aria-hidden="true" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", columnGap: 4, width: "100%", maxWidth: 1200, margin: "32px auto 0" }}>
    <style>{trackingProgressStyles}</style>
    <span className="bt-progress__line" style={{ position: "absolute", left: "10%", right: "10%", height: 6, borderRadius: 999, background: "#e2e8f0" }} />
    {Array.from({ length: 5 }, (_, index) => <span key={index} className="bt-progress__icon" style={{ display: "block", justifySelf: "center", borderRadius: 9999, background: "#e2e8f0" }} />)}
  </div>;
}
