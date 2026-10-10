import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackPageExtension } from "../../../../besttrack-page-extension/src/ready-to-go-definition";
import { createExtensionRegistry } from "../../core/extensions";
import { canDeleteBlock, canDuplicateBlock } from "../../editor/policy";
import { createPageDocumentPuckConfig } from "./page-document-config";

describe("PageDocument Puck permissions", () => {
  it("resolves duplicate permission per block type and id", () => {
    const resolve = vi.fn(({ type }: { id: string; type: string }) => ({ duplicate: type !== "core.text" }));
    const config = createPageDocumentPuckConfig(() => undefined, () => undefined, null, undefined, resolve);
    const permissions = (config.components.Text as { resolvePermissions?: (item: { props: Record<string, unknown> }) => unknown }).resolvePermissions?.({ props: { id: "text-1" } });
    expect(permissions).toEqual({ duplicate: false });
    expect(resolve).toHaveBeenCalledWith({ id: "text-1", type: "core.text" });
  });

  it("hides duplicate for a singleton Recommendations block using the registered policy", () => {
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const document = registry.getTemplate("besttrack.ready-to-go")!.create();
    const recommendation = document.blocks.find((block) => block.type === "besttrack.ready-to-go.recommendations")!;
    const resolve = ({ id, type }: { id: string; type: string }) => {
      const block = document.blocks.find((item) => item.id === id);
      return { duplicate: canDuplicateBlock(block, document.blocks, registry.getBlock(type), undefined) };
    };
    const config = createPageDocumentPuckConfig(() => undefined, () => undefined, null, registry, resolve);
    const component = config.components[recommendation.type] as { resolvePermissions?: (item: { props: Record<string, unknown> }) => unknown };
    expect(component.resolvePermissions?.({ props: { id: recommendation.id } })).toEqual({ duplicate: false });
  });

  it("protects query, progress and delivery, and allows deleting recommendations", () => {
    // 验证业务 Registry 的保护策略确实传给 Puck；推荐商品可以删除，其余基础区块不行。
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const document = registry.getTemplate("besttrack.ready-to-go")!.create();
    const resolve = ({ id, type }: { id: string; type: string }) => {
      const block = document.blocks.find((item) => item.id === id);
      return { delete: canDeleteBlock(block, document.blocks, registry.getBlock(type), undefined) };
    };
    const config = createPageDocumentPuckConfig(() => undefined, () => undefined, null, registry, resolve);
    const expected = {
      "besttrack.ready-to-go.query": false,
      "besttrack.ready-to-go.progress": false,
      "besttrack.ready-to-go.delivery": false,
      "besttrack.ready-to-go.recommendations": true
    } as const;

    for (const [type, canDelete] of Object.entries(expected)) {
      const block = document.blocks.find((item) => item.type === type)!;
      const component = config.components[type] as { resolvePermissions?: (item: { props: Record<string, unknown> }) => unknown };
      expect(component.resolvePermissions?.({ props: { id: block.id } })).toEqual({ delete: canDelete });
    }
  });

  it("marks the canvas block so a sidebar selection can scroll to that content", () => {
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const document = registry.getTemplate("besttrack.ready-to-go")!.create();
    const progress = document.blocks.find((block) => block.type === "besttrack.ready-to-go.progress")!;
    const config = createPageDocumentPuckConfig(() => undefined, () => undefined, progress.id, registry);
    const Component = config.components[progress.type]!.render as (props: Record<string, unknown>) => ReactElement;
    render(<Component {...progress.props} id={progress.id} />);
    expect(screen.getByLabelText("Select Shipment progress in canvas").getAttribute("data-page-document-block-id")).toBe(progress.id);
  });
});
