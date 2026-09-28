import { createPortal } from "react-dom";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdaptiveIframe } from "./AdaptiveIframe";

type ResizeCallback = (entries: Array<{ target: Element }>) => void;
const OriginalResizeObserver = globalThis.ResizeObserver;

class ResizeObserverHarness {
  static instances: ResizeObserverHarness[] = [];
  readonly callback: ResizeCallback;
  observed: Element | null = null;
  disconnected = false;

  constructor(callback: ResizeCallback) {
    this.callback = callback;
    ResizeObserverHarness.instances.push(this);
  }

  observe(target: Element) {
    this.observed = target;
  }

  disconnect() {
    this.disconnected = true;
  }

  notify() {
    if (this.observed) this.callback([{ target: this.observed }]);
  }
}

function iframeDocument() {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameRoot = frameDocument.createElement("div");
  frameRoot.id = "frame-root";
  frameRoot.style.height = "123px";
  frameRoot.style.minHeight = "7px";
  frameDocument.body.append(frameRoot);
  return { frame, frameDocument, frameRoot };
}

function PortalHarness({ frameDocument, frameRoot }: { frameDocument: Document; frameRoot: HTMLElement }) {
  return createPortal(<AdaptiveIframe document={frameDocument}><p>Preview content</p></AdaptiveIframe>, frameRoot);
}

function rafHarness() {
  let nextId = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const request = (callback: FrameRequestCallback) => {
    const id = ++nextId;
    pending.set(id, callback);
    return id;
  };
  const cancel = (id: number) => pending.delete(id);
  const flush = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(0));
  };
  return { request, cancel, flush };
}

describe("AdaptiveIframe", () => {
  afterEach(() => {
    globalThis.ResizeObserver = OriginalResizeObserver;
    ResizeObserverHarness.instances = [];
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("tracks iframe content growth and shrinkage through its wrapper", () => {
    globalThis.ResizeObserver = ResizeObserverHarness as unknown as typeof ResizeObserver;
    const raf = rafHarness();
    vi.stubGlobal("requestAnimationFrame", raf.request);
    vi.stubGlobal("cancelAnimationFrame", raf.cancel);
    const { frame, frameDocument, frameRoot } = iframeDocument();
    const view = render(<PortalHarness frameDocument={frameDocument} frameRoot={frameRoot} />);
    const content = frameRoot.firstElementChild as HTMLElement;
    let height = 180;
    vi.spyOn(content, "getBoundingClientRect").mockImplementation(() => ({ height, width: 400, top: 0, bottom: height, left: 0, right: 400, x: 0, y: 0, toJSON: () => ({}) }));

    const observer = ResizeObserverHarness.instances.at(-1)!;
    observer.notify();
    raf.flush();
    expect(frame.style.height).toBe("180px");
    height = 420;
    observer.notify();
    raf.flush();
    expect(frame.style.height).toBe("420px");
    height = 64;
    observer.notify();
    raf.flush();
    expect(frame.style.height).toBe("64px");
    height = 420;
    observer.notify();
    height = 64;
    observer.notify();
    raf.flush();
    expect(frame.style.height).toBe("64px");
    view.unmount();
  });

  it("disconnects observation and restores the frame height on unmount", () => {
    globalThis.ResizeObserver = ResizeObserverHarness as unknown as typeof ResizeObserver;
    const raf = rafHarness();
    vi.stubGlobal("requestAnimationFrame", raf.request);
    vi.stubGlobal("cancelAnimationFrame", raf.cancel);
    const { frame, frameDocument, frameRoot } = iframeDocument();
    const view = render(<PortalHarness frameDocument={frameDocument} frameRoot={frameRoot} />);
    const content = frameRoot.firstElementChild as HTMLElement;
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue({ height: 180, width: 400, top: 0, bottom: 180, left: 0, right: 400, x: 0, y: 0, toJSON: () => ({}) });
    const observer = ResizeObserverHarness.instances.at(-1)!;
    view.unmount();
    expect(observer.disconnected).toBe(true);
    expect(frame.style.height).toBe("");
    raf.flush();
    expect(frame.style.height).toBe("");
  });
});
