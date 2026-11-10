import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { localeOptions, type Locale } from "./locales";
import { useTrackingCopy } from "./storefront-copy";
import { useTrackingRuntime } from "../tracking-runtime";

const translateUpdatesStyles = `
.bt-translate-updates__trigger {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  margin: 0;
  padding: 0 12px;
  border: 1px solid #d7dee8;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}
.bt-translate-updates__trigger:disabled {
  cursor: not-allowed;
  color: #94a3b8;
  background: #f1f5f9;
  border-color: #e2e8f0;
  opacity: 0.65;
}
.bt-translate-updates__short { display: none; }
.bt-translate-updates__full { display: inline; }
.bt-translate-updates__chevron { display: inline-flex; }
.bt-translate-updates__option {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #0f172a;
  font: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  outline: none;
}
.bt-translate-updates__option[aria-selected="true"],
.bt-translate-updates__option:focus-visible {
  border-color: #0f172a;
}
.bt-translate-updates__check { color: #0f172a; }
@media (max-width: 640px) {
  .bt-translate-updates__trigger { height: 32px; gap: 6px; padding: 0 10px; font-size: 13px; }
  .bt-translate-updates__full { display: none; }
  .bt-translate-updates__short { display: inline; }
  .bt-translate-updates__chevron { display: none; }
  .bt-translate-updates__menu { max-width: min(220px, calc(100vw - 32px)); }
}
`;

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  zIndex: 40,
  boxSizing: "border-box",
  minWidth: 196,
  maxHeight: 320,
  margin: 0,
  padding: 6,
  overflowY: "auto",
  border: "1px solid #eef2f6",
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12)",
  listStyle: "none"
};


function GlobeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 12h17M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9Z" stroke="currentColor" strokeWidth="1.7" />
  </svg>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined }}>
    <path d="M2.4 4.4 6 8l3.6-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function CheckIcon() {
  return <svg className="bt-translate-updates__check" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3.2 8.2 6.4 11.4 12.8 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function stopEditorSelection(event: MouseEvent) {
  event.stopPropagation();
}

/**
 * Ready-to-go 进度卡的物流节点翻译入口：桌面在运单号同一行右侧；放不下或移动端时在运单号正上方。
 * Branded / Sales 放在 Tracking timeline 标题旁。语言列表来自原 Track Page，默认英文；
 * 选中后由 Runtime 写入 URL/本地存储，并在已有成功结果时按新语言重查。
 */
export function TranslateUpdatesMenu() {
  const runtime = useTrackingRuntime();
  const copy = useTrackingCopy();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const locale = runtime.locale;
  const busy = runtime.localeRefreshing || runtime.phase === "loading";

  useEffect(() => {
    if (busy) setOpen(false);
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectLocale = (next: Locale) => {
    if (busy) return;
    runtime.setLocale(next);
    setOpen(false);
  };

  const onOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === "ArrowDown" ? (index + 1) % localeOptions.length
      : event.key === "ArrowUp" ? (index - 1 + localeOptions.length) % localeOptions.length
        : event.key === "Home" ? 0
          : event.key === "End" ? localeOptions.length - 1
            : undefined;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const option = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[data-locale-option]")[nextIndex];
    option?.focus();
  };

  return <div ref={rootRef} className="bt-translate-updates" style={{ position: "relative", flex: "0 0 auto" }}>
    <style>{translateUpdatesStyles}</style>
    <button
      type="button"
      className="bt-translate-updates__trigger"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      aria-label={copy.translateUpdates}
      aria-busy={busy || undefined}
      disabled={busy}
      onMouseDown={stopEditorSelection}
      onClick={(event) => {
        stopEditorSelection(event);
        if (busy) return;
        setOpen((current) => !current);
      }}
    >
      <GlobeIcon />
      <span className="bt-translate-updates__full">{copy.translateUpdates}</span>
      <span className="bt-translate-updates__short">{copy.translateShort}</span>
      <span className="bt-translate-updates__chevron"><ChevronIcon open={open} /></span>
    </button>
    {open && !busy ? <ul id={menuId} role="listbox" aria-label={copy.translateUpdates} className="bt-translate-updates__menu" style={menuStyle}>
      {localeOptions.map((option, index) => {
        const selected = option.code === locale;
        return <li key={option.code} role="presentation">
          <button
            type="button"
            role="option"
            data-locale-option=""
            aria-selected={selected}
            onMouseDown={stopEditorSelection}
            onClick={(event) => { stopEditorSelection(event); selectLocale(option.code); }}
            onKeyDown={(event) => onOptionKeyDown(event, index)}
            className="bt-translate-updates__option"
          >
            <span>{option.label}</span>
            {selected ? <CheckIcon /> : null}
          </button>
        </li>;
      })}
    </ul> : null}
  </div>;
}
