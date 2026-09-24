import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasLibraryDropTarget } from "./CanvasLibraryDropTarget";

const blocks = [{ id: "first", label: "Heading" }, { id: "second", label: "Content" }];

function Canvas({ children, onDrop, onCancel }: { children?: ReactNode; onDrop: (beforeId?: string) => void; onCancel: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  return <div data-testid="canvas-scroll" style={{ overflowY: "auto" }}>
    <div className="pb-canvas-stage">
      <div data-testid="canvas-frame" ref={frameRef}>{children ?? <><div data-page-document-block-id="first" /><div data-page-document-block-id="second" /></>}</div>
      <CanvasLibraryDropTarget frameRef={frameRef} blocks={blocks} label="Text" adminLocale="en" onDrop={onDrop} onCancel={onCancel} />
    </div>
  </div>;
}

function setRect(element: Element, top: number, height: number, left = 100, width = 600) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ top, bottom: top + height, left, right: left + width, width, height, x: left, y: top, toJSON: () => ({}) });
}

function drag(type: "dragOver" | "drop" | "dragLeave", element: HTMLElement, y: number, relatedTarget?: EventTarget | null) {
  const event = createEvent[type](element, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientY: { value: y },
    clientX: { value: 200 },
    relatedTarget: { value: relatedTarget ?? null },
    dataTransfer: { value: { dropEffect: "none" } }
  });
  fireEvent(element, event);
}

function fixture(children?: ReactNode) {
  const onDrop = vi.fn();
  const onCancel = vi.fn();
  const rendered = render(<Canvas onDrop={onDrop} onCancel={onCancel}>{children}</Canvas>);
  const frame = screen.getByTestId("canvas-frame");
  const target = screen.getByTestId("canvas-drop-target");
  const scroll = screen.getByTestId("canvas-scroll");
  setRect(target, 100, 600);
  setRect(frame, 100, 600);
  setRect(scroll, 100, 600);
  const first = frame.querySelector('[data-page-document-block-id="first"]');
  const second = frame.querySelector('[data-page-document-block-id="second"]');
  if (first) setRect(first, 100, 200);
  if (second) setRect(second, 300, 400);
  return { ...rendered, frame, target, scroll, onDrop, onCancel };
}

describe("canvas library drop target", () => {
  let pendingFrames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;

  beforeEach(() => {
    pendingFrames = new Map();
    nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      pendingFrames.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => pendingFrames.delete(id)));
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function nextFrame(timestamp = 16) {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    act(() => callbacks.forEach((callback) => callback(timestamp)));
  }

  it("drops at the previewed slot even when the final event has a different coordinate", () => {
    const { target, onDrop } = fixture();
    drag("dragOver", target, 290);
    expect((target.querySelector(".pb-canvas-drop-marker") as HTMLElement).style.top).toBe("200px");
    expect(target.querySelector(".pb-canvas-drop-marker__label")).toHaveTextContent("Position 2");
    drag("drop", target, 120);
    expect(onDrop).toHaveBeenCalledWith("second");
    expect(target.querySelector(".pb-canvas-drop-marker")).toBeNull();
  });

  it("uses the latest preview when dragover moves across insertion slots quickly", () => {
    const { target, onDrop } = fixture();
    drag("dragOver", target, 290);
    drag("dragOver", target, 620);
    drag("drop", target, 120);
    expect(onDrop).toHaveBeenCalledWith(undefined);
  });

  it("keeps an explicit append preview rather than recalculating from the drop event", () => {
    const { target, onDrop } = fixture();
    drag("dragOver", target, 620);
    drag("drop", target, 120);
    expect(onDrop).toHaveBeenCalledWith(undefined);
  });

  it("clears the slot when the pointer leaves and calculates the next entry afresh", () => {
    const { target, onDrop } = fixture();
    drag("dragOver", target, 120);
    drag("dragLeave", target, 800);
    expect(target.querySelector(".pb-canvas-drop-marker")).toBeNull();
    drag("drop", target, 620);
    expect(onDrop).toHaveBeenCalledWith(undefined);
  });

  it("ignores blocks from another editor even when their ids match", () => {
    const foreign = document.createElement("div");
    foreign.dataset.pageDocumentBlockId = "first";
    document.body.appendChild(foreign);
    setRect(foreign, 800, 300);
    try {
      const { target, onDrop } = fixture(<div />);
      drag("dragOver", target, 650);
      drag("drop", target, 650);
      expect(onDrop).toHaveBeenCalledWith(undefined);
    } finally { foreign.remove(); }
  });

  it("translates scaled iframe coordinates into the outer canvas insertion slot", () => {
    const { target, frame, onDrop } = fixture(<iframe title="Canvas preview" />);
    const iframe = frame.querySelector("iframe")!;
    setRect(iframe, 100, 600);
    Object.defineProperty(iframe, "clientHeight", { configurable: true, value: 1200 });
    iframe.contentDocument!.body.innerHTML = '<div data-page-document-block-id="first"></div><div data-page-document-block-id="second"></div>';
    setRect(iframe.contentDocument!.body.children[0]!, 0, 400);
    setRect(iframe.contentDocument!.body.children[1]!, 400, 800);
    drag("dragOver", target, 220);
    expect((target.querySelector(".pb-canvas-drop-marker") as HTMLElement).style.top).toBe("200px");
    drag("drop", target, 220);
    expect(onDrop).toHaveBeenCalledWith("second");
  });

  it("scrolls while held near an edge and cancels the animation on leave and unmount", () => {
    const { target, scroll, unmount } = fixture();
    Object.defineProperties(scroll, { clientHeight: { configurable: true, value: 600 }, scrollHeight: { configurable: true, value: 1600 } });
    drag("dragOver", target, 690);
    nextFrame();
    nextFrame(32);
    expect(scroll.scrollTop).toBeGreaterThan(0);
    drag("dragLeave", target, 800);
    expect(pendingFrames.size).toBe(0);
    drag("dragOver", target, 690);
    expect(pendingFrames.size).toBeGreaterThan(0);
    unmount();
    expect(pendingFrames.size).toBe(0);
  });

  it("cancels a drag on Escape and stops pending scrolling", () => {
    const { target, onCancel } = fixture();
    drag("dragOver", target, 690);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(target.querySelector(".pb-canvas-drop-marker")).toBeNull();
    expect(pendingFrames.size).toBe(0);
  });

  it("cancels when the drag source ends outside the target", () => {
    const { target, onCancel } = fixture();
    drag("dragOver", target, 290);
    fireEvent.dragEnd(document);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(target.querySelector(".pb-canvas-drop-marker")).toBeNull();
  });

  it("cancels when a drop lands outside the target", () => {
    const { target, onCancel } = fixture();
    drag("dragOver", target, 290);
    fireEvent.drop(document.body);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(target.querySelector(".pb-canvas-drop-marker")).toBeNull();
  });
});
