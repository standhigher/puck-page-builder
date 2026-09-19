/* eslint-disable react-refresh/only-export-components -- this module intentionally exports the picker UI and its host Runtime contract together. */
import { createContext, useCallback, useContext, useState, type CSSProperties, type ReactNode } from "react";
import type { FieldProps } from "@standhigher/puck-page-builder/runtime";
import { isShopifyResourceReference, type ShopifyResourceBrowser, type ShopifyResourceKind, type ShopifyResourceReference } from "./shopify-resource-contract";
export { getResolvedShopifyResource, getShopifyResourceResolutionError, isShopifyResourceReference, resolveShopifyResources, type ShopifyResolvedResource, type ShopifyResourceAvailability, type ShopifyResourceBrowser, type ShopifyResourceKind, type ShopifyResourceReference, type ShopifyResourceResolution, type ShopifyResourceResolutionError, type ShopifyResourceResolver, type ShopifyResourceSearchInput, type ShopifyResourceSearchPage } from "./shopify-resource-contract";

const ShopifyResourceBrowserContext = createContext<ShopifyResourceBrowser | undefined>(undefined);

export function ShopifyResourcePickerProvider({ browser, children }: { browser?: ShopifyResourceBrowser; children: ReactNode }) {
  return <ShopifyResourceBrowserContext.Provider value={browser}>{children}</ShopifyResourceBrowserContext.Provider>;
}


const pickerSurface: CSSProperties = { marginTop: 8, padding: 12, border: "1px solid #c9cccf", borderRadius: 8, background: "#fff", color: "#202223" };
const pickerButton: CSSProperties = { minHeight: 32, padding: "6px 10px", border: "1px solid #8c9196", borderRadius: 6, background: "#fff", color: "#202223", font: "inherit", cursor: "pointer" };

function ResourceField({ value, onChange, kind }: FieldProps<unknown> & { kind: ShopifyResourceKind }) {
  const browser = useContext(ShopifyResourceBrowserContext);
  const selected = isShopifyResourceReference(value, kind) ? value : undefined;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<readonly ShopifyResourceReference[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const search = useCallback(async (nextQuery: string, nextCursor?: string, append = false) => {
    if (!browser) return;
    setState("loading");
    try {
      const page = await browser.search({ kinds: [kind], query: nextQuery.trim(), ...(nextCursor ? { cursor: nextCursor } : {}), limit: 20 });
      const validItems = page.items.filter((item) => isShopifyResourceReference(item, kind));
      setItems((current) => append ? [...current, ...validItems.filter((item) => !current.some((existing) => existing.id === item.id))] : validItems);
      setCursor(page.nextCursor);
      setState("idle");
    } catch {
      setState("error");
    }
  }, [browser, kind]);

  const name = kind === "product" ? "product" : "collection";
  return <div data-shopify-resource-field={kind}>
    {selected ? <p style={{ margin: "0 0 8px" }}><strong>{selected.title}</strong><br /><small>{selected.id}</small></p> : <p style={{ margin: "0 0 8px" }}>No {name} selected.</p>}
    <button type="button" style={pickerButton} onClick={() => {
      if (open) { setOpen(false); return; }
      setOpen(true);
      if (browser) void search("");
      else setState("error");
    }}>{open ? "Close selector" : `Select ${name}`}</button>
    {open ? <div role="dialog" aria-label={`Select Shopify ${name}`} style={pickerSurface}>
      <form onSubmit={(event) => { event.preventDefault(); void search(query); }}>
        <label style={{ display: "block" }}>Search {name}s<input aria-label={`Search ${name}s`} value={query} onChange={(event) => setQuery(event.currentTarget.value)} style={{ boxSizing: "border-box", display: "block", width: "100%", minHeight: 32, marginTop: 4, padding: "6px 8px" }} /></label>
        <button type="submit" disabled={state === "loading"} style={{ ...pickerButton, marginTop: 8 }}>{state === "loading" ? "Searching…" : "Search"}</button>
      </form>
      {state === "error" ? <p role="alert">The authorized resource service is unavailable. Try again later.</p> : null}
      {state === "idle" && !items.length ? <p role="status">No {name}s found.</p> : null}
      {items.length ? <ul style={{ display: "grid", gap: 6, margin: "12px 0", padding: 0, listStyle: "none" }}>{items.map((item) => <li key={item.id}><button type="button" style={{ ...pickerButton, width: "100%", textAlign: "left" }} onClick={() => { onChange(item); setOpen(false); }}><strong>{item.title}</strong>{item.handle ? <small style={{ display: "block" }}>{item.handle}</small> : null}</button></li>)}</ul> : null}
      {cursor ? <button type="button" disabled={state === "loading"} style={pickerButton} onClick={() => void search(query, cursor, true)}>Load more</button> : null}
    </div> : null}
  </div>;
}

export function ShopifyProductResourceField(props: FieldProps<unknown>) {
  return <ResourceField {...props} kind="product" />;
}

export function ShopifyCollectionResourceField(props: FieldProps<unknown>) {
  return <ResourceField {...props} kind="collection" />;
}
