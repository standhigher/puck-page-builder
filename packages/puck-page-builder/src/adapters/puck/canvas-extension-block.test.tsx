import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CanvasExtensionBlock } from "./canvas-extension-block";

function Harness({ active = true, children, onParentPointerDown, onSelect }: { active?: boolean; children?: ReactNode; onParentPointerDown?: () => void; onSelect?: () => void }) {
  return <div onPointerDown={onParentPointerDown}>
    <CanvasExtensionBlock active={active} blockId="block-1" label="Block" onSelect={onSelect ?? (() => undefined)}>{children}</CanvasExtensionBlock>
  </div>;
}

describe("CanvasExtensionBlock editing gesture protection", () => {
  it("keeps the block background draggable by allowing its pointerdown to bubble", () => {
    const onParentPointerDown = vi.fn();
    render(<Harness onParentPointerDown={onParentPointerDown} />);
    fireEvent.pointerDown(screen.getByLabelText("Select Block in canvas"));
    expect(onParentPointerDown).toHaveBeenCalledOnce();
  });

  it("stops pointerdown from editing controls without blocking the block parent", () => {
    const onParentPointerDown = vi.fn();
    render(<Harness onParentPointerDown={onParentPointerDown}><input aria-label="Canvas input" /></Harness>);
    fireEvent.pointerDown(screen.getByLabelText("Canvas input"));
    expect(onParentPointerDown).not.toHaveBeenCalled();
  });

  it("protects contenteditable controls from the drag sensor", () => {
    const onParentPointerDown = vi.fn();
    render(<Harness onParentPointerDown={onParentPointerDown}><div contentEditable aria-label="Canvas editor" /></Harness>);
    fireEvent.pointerDown(screen.getByLabelText("Canvas editor"));
    expect(onParentPointerDown).not.toHaveBeenCalled();
  });

  it("does not install editing protection while inactive", () => {
    const onParentPointerDown = vi.fn();
    const view = render(<Harness active={false} onParentPointerDown={onParentPointerDown}><input aria-label="Canvas input" /></Harness>);
    fireEvent.pointerDown(screen.getByLabelText("Canvas input"));
    expect(onParentPointerDown).toHaveBeenCalledOnce();
    view.rerender(<Harness active onParentPointerDown={onParentPointerDown}><input aria-label="Canvas input" /></Harness>);
    fireEvent.pointerDown(screen.getByLabelText("Canvas input"));
    expect(onParentPointerDown).toHaveBeenCalledOnce();
  });

  it("does not select the block when an editing control receives a keyboard space", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect}><input aria-label="Canvas input" /></Harness>);
    fireEvent.keyDown(screen.getByLabelText("Canvas input"), { key: " " });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects with Enter or Space only when the block itself has keyboard focus", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect}><div contentEditable aria-label="Canvas editor" /></Harness>);
    fireEvent.keyDown(screen.getByLabelText("Canvas editor"), { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
    const block = screen.getByLabelText("Select Block in canvas");
    expect(fireEvent.keyDown(block, { key: " " })).toBe(false);
    expect(fireEvent.keyDown(block, { key: "Enter" })).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("removes the protection when the active block is deactivated", () => {
    const onParentPointerDown = vi.fn();
    const view = render(<Harness active onParentPointerDown={onParentPointerDown}><input aria-label="Canvas input" /></Harness>);
    view.rerender(<Harness active={false} onParentPointerDown={onParentPointerDown}><input aria-label="Canvas input" /></Harness>);
    fireEvent.pointerDown(screen.getByLabelText("Canvas input"));
    expect(onParentPointerDown).toHaveBeenCalledOnce();
  });

  it("removes the native gesture listener and portal attribute on unmount", () => {
    const view = render(<Harness><input aria-label="Canvas input" /></Harness>);
    const block = screen.getByLabelText("Select Block in canvas");
    const input = screen.getByLabelText("Canvas input");
    const removeEventListener = vi.spyOn(block, "removeEventListener");
    expect(block.getAttribute("data-puck-overlay-portal")).toBe("true");
    view.unmount();
    expect(removeEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function), { capture: true });
    expect(block.getAttribute("data-puck-overlay-portal")).toBeNull();
    const afterUnmount = vi.fn();
    block.addEventListener("pointerdown", afterUnmount);
    fireEvent.pointerDown(input);
    expect(afterUnmount).toHaveBeenCalledOnce();
  });
});
