import { useId } from "react";

const loadingStyles = `
@keyframes bt-tracking-pin-float {
  0%, 100% { transform: translateY(-1px); }
  50% { transform: translateY(-5px); }
}
.bt-tracking-loading__pin {
  transform-box: fill-box;
  transform-origin: center;
  animation: bt-tracking-pin-float 1.8s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .bt-tracking-loading__pin { animation: none; transform: translateY(-1px); }
}
`;

/** Query feedback stays local to the form and disappears with its loading state. */
export function TrackingLoading() {
  const id = useId();
  return <>
    <style>{loadingStyles}</style>
    <div role="status" aria-label="查询中..." aria-live="polite" aria-atomic="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 56, paddingBottom: 8, textAlign: "center" }}>
      <p style={{ margin: 0, color: "var(--pb-color-muted, #64748b)", fontSize: 14, fontWeight: 400, lineHeight: "20px" }}>查询中...</p>
      <svg width="56" height="64" viewBox="0 0 56 64" fill="none" aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}-top`} x1="10" y1="28" x2="44" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF0DA" />
          <stop offset="1" stopColor="#EABD8E" />
        </linearGradient>
        <linearGradient id={`${id}-left`} x1="11" y1="35" x2="29" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE8CD" />
          <stop offset="1" stopColor="#F3C79C" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="28" y1="40" x2="45" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8D2AA" />
          <stop offset="1" stopColor="#DCA574" />
        </linearGradient>
        <linearGradient id={`${id}-pin`} x1="21" y1="8" x2="35" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD18A" />
          <stop offset="1" stopColor="#F6A34A" />
        </linearGradient>
      </defs>
      <path d="m11 35 17-10 17 10-17 10-17-10Z" fill={`url(#${id}-top)`} />
      <path d="M11 35v19l17 10V45L11 35Z" fill={`url(#${id}-left)`} />
      <path d="M28 45v19l17-10V35L28 45Z" fill={`url(#${id}-right)`} />
      <path d="m18 31 17 10v19l4-2V39L22 29l-4 2Z" fill="#FFF3E0" fillOpacity=".6" />
      <path d="M11 35 28 45 45 35M28 45v19" stroke="#FFF8EC" strokeOpacity=".35" strokeWidth=".7" />
      <g className="bt-tracking-loading__pin">
        <path d="M28 8a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" fill={`url(#${id}-pin)`} fillRule="evenodd" />
      </g>
      </svg>
    </div>
  </>;
}
