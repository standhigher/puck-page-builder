import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollToTrackingResult, trackingResultScrollOffset } from "./shopify/timeline";

function element(tag: string, top: number, height: number, css = "") {
  const node = document.createElement(tag);
  node.style.cssText = css;
  node.getBoundingClientRect = () => new DOMRect(0, top, 594, height);
  return node;
}

function result(top = 524) {
  const node = element("section", top, 320);
  node.setAttribute("data-tracking-result", "");
  document.body.append(node);
  return node;
}

afterEach(() => {
  document.body.replaceChildren();
  document.body.style.cssText = "";
  document.body.scrollTop = 0;
  Reflect.deleteProperty(document.body, "scrollTo");
  document.documentElement.style.cssText = "";
  vi.restoreAllMocks();
});

describe("storefront result scroll isolation", () => {
  it.each(["canvas", "div"])("ignores a full-screen %s from another app", (tag) => {
    const target = result();
    const overlay = element(tag, 0, window.innerHeight, "position: fixed; top: 0; pointer-events: none;");
    document.body.append(overlay);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    scrollToTrackingResult(document, (callback) => callback());

    expect(trackingResultScrollOffset(target)).toBe(64);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 460, behavior: "smooth" });
  });

  it("ignores unrelated fixed overlays even when they are shorter than the viewport", () => {
    const target = result();
    document.body.prepend(element("div", 0, 300, "position: fixed; top: 0;"));
    expect(trackingResultScrollOffset(target)).toBe(64);
  });

  it("keeps a real header wrapper's height while ignoring full-screen navigation drawers", () => {
    const wrapper = element("div", 0, 96, "position: fixed; top: 0;");
    wrapper.append(element("header", 0, 96));
    document.body.append(wrapper, element("nav", 0, window.innerHeight, "position: fixed; top: 0;"));
    const target = result();
    expect(trackingResultScrollOffset(target)).toBe(104);
  });

  it("ignores transparent and offscreen fixed navigation", () => {
    document.body.append(
      element("header", 0, 150, "position: fixed; top: 0; opacity: 0;"),
      element("nav", -150, 150, "position: fixed; top: 0; transform: translateY(-100%);")
    );
    expect(trackingResultScrollOffset(result())).toBe(64);
  });

  it("never reserves more than a third of the viewport for headers or host overrides", () => {
    document.body.append(element("header", 0, window.innerHeight - 1, "position: sticky; top: 0;"));
    const target = result();
    expect(trackingResultScrollOffset(target)).toBe(window.innerHeight / 3);
    document.documentElement.style.setProperty("--bt-tracking-scroll-offset", "9999px");
    expect(trackingResultScrollOffset(target)).toBe(window.innerHeight / 3);
  });

  it("uses coordinates independent of theme scroll-margin and scroll-padding rules", () => {
    const target = result();
    target.style.setProperty("scroll-margin-top", "9999px", "important");
    document.documentElement.style.setProperty("scroll-padding-top", "9999px", "important");
    vi.spyOn(window, "scrollY", "get").mockReturnValue(120);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    scrollToTrackingResult(document, (callback) => callback());
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 580, behavior: "smooth" });
  });

  it("skips non-scrolling overflow wrappers and scrolls the document", () => {
    const wrapper = element("div", 100, 800, "overflow-y: auto;");
    document.body.append(wrapper);
    const target = result();
    wrapper.append(target);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    scrollToTrackingResult(document, (callback) => callback());
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 460, behavior: "smooth" });
  });

  it("calculates coordinates inside an actual scrolling host container", () => {
    const wrapper = element("div", 100, 500, "overflow-y: auto;");
    Object.defineProperties(wrapper, { scrollHeight: { value: 1500 }, clientHeight: { value: 500 }, clientTop: { value: 2 } });
    wrapper.scrollTop = 30;
    wrapper.scrollTo = vi.fn();
    document.body.append(wrapper);
    wrapper.append(result());
    const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    scrollToTrackingResult(document, (callback) => callback());
    expect(wrapper.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 388, behavior: "smooth" });
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it("scrolls an independently scrolling body instead of the window", () => {
    const body = document.body;
    body.style.overflowY = "auto";
    vi.spyOn(body, "scrollHeight", "get").mockReturnValue(2400);
    vi.spyOn(body, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 594, 600));
    body.scrollTop = 40;
    body.scrollTo = vi.fn();
    result(900);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    scrollToTrackingResult(document, (callback) => callback());

    expect(body.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 876, behavior: "smooth" });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls an outer page after an inner host is positioned", () => {
    const wrapper = element("div", 900, 500, "overflow-y: auto;");
    Object.defineProperties(wrapper, { scrollHeight: { value: 1500 }, clientHeight: { value: 500 }, clientTop: { value: 0 } });
    wrapper.scrollTop = 0;
    wrapper.scrollTo = vi.fn();
    document.body.append(wrapper);
    const target = result(1324);
    wrapper.append(target);
    const pageScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(2400);
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(792);

    scrollToTrackingResult(document, (callback) => callback());

    expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 360, behavior: "smooth" });
    expect(pageScroll).toHaveBeenCalledWith({ top: 900, behavior: "smooth" });
  });
});
