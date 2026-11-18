import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrollCanvasBlockIntoView } from "./canvas-scroll";

function rect(element: Element, top: number, height: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ top, bottom: top + height, left: 0, right: 600, x: 0, y: top, height, width: 600, toJSON: () => ({}) });
}

function fixture(iframe = false) {
  const host = document.createElement("div");
  host.style.overflow = "hidden";
  host.innerHTML = `<header>Editor toolbar</header><main class="pb-canvas-area"><div class="pb-canvas-frame">${iframe ? '<iframe title="Preview"></iframe>' : '<div data-page-document-block-id="target"></div>'}</div></main>`;
  document.body.appendChild(host);
  const canvas = host.querySelector<HTMLElement>("main")!;
  const frame = host.querySelector<HTMLElement>(".pb-canvas-frame")!;
  Object.defineProperties(canvas, {
    clientHeight: { configurable: true, value: 500 },
    offsetHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1800 }
  });
  host.scrollTop = 30;
  canvas.scrollTop = 100;
  rect(canvas, 56, 500);
  return { host, canvas, frame };
}

describe("canvas-only block scrolling", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
  });
  afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

  it("aligns a block in its canvas without scrolling hidden ancestors or the page", () => {
    const { host, canvas, frame } = fixture();
    const block = frame.firstElementChild!;
    rect(block, 456, 200);
    const unboundedScroll = vi.spyOn(block, "scrollIntoView").mockImplementation(() => { host.scrollTop = 430; });
    const pageScroll = vi.spyOn(window, "scrollTo");
    document.documentElement.scrollTop = 25;

    scrollCanvasBlockIntoView("target", frame);

    expect(canvas.scrollTop).toBe(500);
    expect(host.scrollTop).toBe(30);
    expect(document.documentElement.scrollTop).toBe(25);
    expect(unboundedScroll).not.toHaveBeenCalled();
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it("uses the visual block position when the canvas preview is zoomed", () => {
    const { canvas, frame } = fixture();
    // A 50% preview puts a block 200 screen pixels below the scrollport's top.
    rect(frame.firstElementChild!, 256, 100);
    scrollCanvasBlockIntoView("target", frame);
    expect(canvas.scrollTop).toBe(300);
  });

  it("maps a scaled iframe block into the outer canvas scrollport", () => {
    const { host, canvas, frame } = fixture(true);
    const iframe = frame.querySelector("iframe")!;
    iframe.contentDocument!.body.innerHTML = '<div data-page-document-block-id="target"></div>';
    Object.defineProperties(iframe, { clientHeight: { configurable: true, value: 1200 }, offsetHeight: { configurable: true, value: 1200 } });
    rect(iframe, 76, 600);
    rect(iframe.contentDocument!.body.firstElementChild!, 400, 200);

    scrollCanvasBlockIntoView("target", frame);

    expect(canvas.scrollTop).toBe(320);
    expect(host.scrollTop).toBe(30);
    expect(iframe.contentDocument!.documentElement.scrollTop).toBe(0);
  });

  it("accounts for the canvas border and scale without changing horizontal scroll", () => {
    const { host, canvas, frame } = fixture();
    Object.defineProperties(canvas, {
      clientTop: { configurable: true, value: 4 },
      offsetHeight: { configurable: true, value: 508 }
    });
    rect(canvas, 56, 254);
    rect(frame.firstElementChild!, 258, 100);
    canvas.scrollLeft = 19;

    scrollCanvasBlockIntoView("target", frame);

    expect(canvas.scrollTop).toBe(500);
    expect(canvas.scrollLeft).toBe(19);
    expect(host.scrollTop).toBe(30);
  });

  it.each(["collapsed", "scaled-to-zero"])("leaves a %s canvas at its current position", (state) => {
    const { host, canvas, frame } = fixture();
    rect(frame.firstElementChild!, 456, 200);
    if (state === "collapsed") Object.defineProperty(canvas, "clientHeight", { value: 0 });
    else vi.mocked(canvas.getBoundingClientRect).mockReturnValue(new DOMRect(0, 56, 600, 0));

    scrollCanvasBlockIntoView("target", frame);

    expect(canvas.scrollTop).toBe(100);
    expect(host.scrollTop).toBe(30);
  });

  it("clamps to canvas boundaries instead of advancing the host scroll", () => {
    const { host, canvas, frame } = fixture();
    rect(frame.firstElementChild!, 2400, 200);
    scrollCanvasBlockIntoView("target", frame);
    expect(canvas.scrollTop).toBe(1300);
    expect(host.scrollTop).toBe(30);

    vi.mocked(frame.firstElementChild!.getBoundingClientRect).mockReturnValue(new DOMRect(0, -2000, 600, 200));
    scrollCanvasBlockIntoView("target", frame);
    expect(canvas.scrollTop).toBe(0);
    expect(host.scrollTop).toBe(30);
  });

  it("never scrolls a matching block outside the supplied editor", () => {
    const { canvas, frame } = fixture();
    frame.innerHTML = "";
    const foreign = document.createElement("div");
    foreign.dataset.pageDocumentBlockId = "target";
    document.body.appendChild(foreign);
    const scroll = vi.spyOn(foreign, "scrollIntoView");

    scrollCanvasBlockIntoView("target", frame);
    scrollCanvasBlockIntoView("target");

    expect(canvas.scrollTop).toBe(100);
    expect(scroll).not.toHaveBeenCalled();
  });
});
