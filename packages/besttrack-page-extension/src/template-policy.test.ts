import { describe, expect, it } from "vitest";
import { createExtensionRegistry, validatePageDocumentWithRegistry } from "../../puck-page-builder/src/core/extensions";
import { canApplyCanvasDocument, canDeleteBlock, canDuplicateBlock } from "../../puck-page-builder/src/editor/policy";
import { bestTrackDocumentValidationExtensions } from "./validation";
import { brandedTemplatePolicy } from "./branded-definition";
import { bestTrackBrandedExtension } from "./branded-definition";
import { readyToGoTemplatePolicy } from "./ready-to-go-definition";
import { bestTrackPageExtension } from "./ready-to-go-definition";
import { salesTemplatePolicy } from "./sales-definition";
import { bestTrackSalesExtension } from "./sales-definition";
import { isValidOrderEmail, isValidOrderNumber, isValidTrackingNumber } from "./tracking-page-runtime";

describe("BestTrack template PRD compatibility metadata", () => {
  it("declares stable default order, singleton blocks, and host-enforced protected blocks", () => {
    expect(readyToGoTemplatePolicy.defaultBlockOrder).toEqual([
      "besttrack.ready-to-go.query",
      "besttrack.ready-to-go.progress",
      "besttrack.ready-to-go.delivery",
      "besttrack.ready-to-go.recommendations"
    ]);
    expect(brandedTemplatePolicy.blocks.find((block) => block.blockType === "besttrack.branded.tracking-experience")).toMatchObject({ singleton: true, deletable: false });
    expect(salesTemplatePolicy.blocks.find((block) => block.blockType === "besttrack.sales.query")).toMatchObject({ singleton: true, deletable: false });
    expect(salesTemplatePolicy.enforcement).toBe("core-block-policy");
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.query")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.progress")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.delivery")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.delivery")?.fields).toMatchObject({
      heading: { validation: { maxLength: 52 } },
      contentsHeading: { validation: { maxLength: 52 } },
      carrierHeading: { validation: { maxLength: 52 } }
    });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.recommendations")?.policy).toEqual({ singleton: true });
    expect(bestTrackBrandedExtension.blocks?.find((block) => block.type === "besttrack.branded.recommendations")?.policy).toEqual({ singleton: true });
    expect(bestTrackSalesExtension.blocks?.find((block) => block.type === "besttrack.sales.recommendations")?.policy).toEqual({ singleton: true });
    expect(bestTrackBrandedExtension.blocks?.find((block) => block.type === "besttrack.branded.tracking-experience")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
    expect(bestTrackSalesExtension.blocks?.find((block) => block.type === "besttrack.sales.query")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
  });

  // 各模板用不同区块组合承载同样的必要能力；逐一检查操作权限和画布整份文档替换入口。
  it.each([
    [bestTrackPageExtension, readyToGoTemplatePolicy, ["query", "progress", "delivery"]],
    [bestTrackBrandedExtension, brandedTemplatePolicy, ["tracking-experience"]],
    [bestTrackSalesExtension, salesTemplatePolicy, ["query", "order-items", "other-tracking"]]
  ] as const)("protects the base capabilities in $0.name documents and canvas changes", (extension, policy, suffixes) => {
    const registry = createExtensionRegistry([extension]);
    const document = registry.getTemplate(policy.templateId)!.create();
    for (const suffix of suffixes) {
      const type = `${policy.templateId}.${suffix}`;
      const block = document.blocks.find((item) => item.type === type)!;
      expect(block).toBeDefined();
      expect(policy.blocks.find((item) => item.blockType === type)).toMatchObject({ singleton: true, deletable: false });
      expect(canDeleteBlock(block, document.blocks, registry.getBlock(type), undefined)).toBe(false);
      expect(canDuplicateBlock(block, document.blocks, registry.getBlock(type), undefined)).toBe(false);
      // 即使绕过删除按钮直接提交少一个区块的画布结果，也必须被编辑策略拒绝。
      expect(canApplyCanvasDocument(document, { ...document, blocks: document.blocks.filter((item) => item.id !== block.id) }, (blockType) => registry.getBlock(blockType), undefined)).toBe(false);
    }
    const recommendationsType = `${policy.templateId}.recommendations`;
    const recommendations = document.blocks.find((item) => item.type === recommendationsType)!;
    expect(policy.blocks.find((item) => item.blockType === recommendationsType)).toMatchObject({ singleton: true, deletable: true });
    expect(canDeleteBlock(recommendations, document.blocks, registry.getBlock(recommendationsType), undefined)).toBe(true);
    expect(canDuplicateBlock(recommendations, document.blocks, registry.getBlock(recommendationsType), undefined)).toBe(false);
    expect(canApplyCanvasDocument(document, { ...document, blocks: document.blocks.filter((item) => item.id !== recommendations.id) }, (blockType) => registry.getBlock(blockType), undefined)).toBe(true);
  });

  it("accepts merchant recommendation products through client and server contracts", () => {
    // 编辑器字段与服务端轻量校验使用不同 Registry，商家选品必须在两端都能通过。
    const extensions = [bestTrackPageExtension, bestTrackBrandedExtension, bestTrackSalesExtension];
    const registry = createExtensionRegistry(extensions);
    const serverRegistry = createExtensionRegistry(bestTrackDocumentValidationExtensions);
    for (const extension of extensions) {
      const document = registry.getTemplate(extension.name)!.create();
      const block = document.blocks.find((item) => item.type.endsWith(".recommendations"))!;
      block.props.products = [{ id: "gid://shopify/Product/123", title: "Merchant selection", handle: "merchant-selection" }];
      expect(registry.getBlock(block.type)?.fields.products).toMatchObject({ control: "products" });
      expect(validatePageDocumentWithRegistry(document, registry).filter((issue) => issue.path.includes("products"))).toEqual([]);
      expect(validatePageDocumentWithRegistry(document, serverRegistry).filter((issue) => issue.path.includes("products"))).toEqual([]);
    }
  });

  it("keeps query validation local and deterministic", () => {
    // 这里保留旧格式校验工具自身的契约；共用查询表单已改为 trim + 非空，不调用这些工具。
    expect(isValidTrackingNumber("BT-2048-DEMO")).toBe(true);
    expect(isValidTrackingNumber("not valid!")).toBe(false);
    expect(isValidOrderNumber("ORDER-2048")).toBe(true);
    expect(isValidOrderNumber("x")).toBe(true);
    expect(isValidOrderEmail("customer@example.test")).toBe(true);
    expect(isValidOrderEmail("not-an-email")).toBe(false);
  });
});
