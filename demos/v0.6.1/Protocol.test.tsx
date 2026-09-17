import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createExtensionRegistry, type PageBuilderExtension } from "../../packages/puck-page-builder/src/core/extensions";
import { createPageDocument, migratePageDocument } from "../../packages/puck-page-builder/src/core/schema/page-document";
import { mergeThemeTokens } from "../../packages/puck-page-builder/src/core/theme";
import { WebRenderer } from "../../packages/puck-page-builder/src/renderer/web/WebRenderer";

const extension: PageBuilderExtension = {
  name: "besttrack.protocol",
  version: "0.6.1",
  blocks: [{
    type: "besttrack.protocol.notice",
    version: 1,
    label: "Protocol notice",
    category: "BestTrack",
    targets: ["web"],
    defaultProps: { content: "Protocol ready" },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }, { id: "contrast", label: "Contrast", theme: { "color.primary": "#222222" } }],
    fields: {},
    render: { web: ({ content }: { content: string }) => <p>{content}</p> }
  }],
  templates: [{
    id: "besttrack.protocol.starter",
    version: 1,
    name: "Protocol starter",
    target: "web",
    source: "built-in",
    requiredBlocks: ["besttrack.protocol.notice"],
    theme: { "color.primary": "#005bd3" },
    create: () => createPageDocument({ pageId: "protocol-starter", templateId: "besttrack.protocol.starter", templateVersion: 1 })
  }]
};

describe("V0.6.1 protocol", () => {
  it("creates and validates only the new Theme and Variant document shape", () => {
    const document = createPageDocument({ pageId: "new-page", blocks: [{ id: "text", type: "core.text", version: 1, props: { content: "Hello" } }] });
    expect(document).toMatchObject({ schemaVersion: 1, theme: {}, blocks: [{ variant: "default", style: {} }] });
    expect(migratePageDocument(document)).toEqual({ success: true, data: document, migrated: false });
    expect(migratePageDocument({ ...document, blocks: [{ ...document.blocks[0], style: { unknown: "value" } }] })).toMatchObject({ success: false });
  });

  it("resolves System → Template → Page → Variant → Block Token precedence", () => {
    const registry = createExtensionRegistry([extension]);
    const document = createPageDocument({
      pageId: "themed-page",
      templateId: "besttrack.protocol.starter",
      templateVersion: 1,
      theme: { "color.primary": "#008060" },
      blocks: [{ id: "notice", type: "besttrack.protocol.notice", version: 1, props: { content: "Themed notice" }, variant: "contrast", style: { "color.primary": "#d72c0d" } }]
    });
    expect(mergeThemeTokens(registry.getTemplate(document.templateId!)?.theme, document.theme, { "color.primary": "#222222" }, document.blocks[0]?.style)["color.primary"]).toBe("#d72c0d");

    render(<WebRenderer document={document} registry={registry} />);
    const block = screen.getByText("Themed notice").parentElement!;
    expect(block).toHaveAttribute("data-block-variant", "contrast");
    expect(block.style.getPropertyValue("--pb-color-primary")).toBe("#d72c0d");
  });

  it("rejects a template whose required block has not been registered", () => {
    const missing: PageBuilderExtension = {
      name: "besttrack.missing",
      version: "0.6.1",
      templates: [{ id: "besttrack.missing.template", version: 1, name: "Missing", target: "web", source: "custom", requiredBlocks: ["besttrack.missing.block"], create: () => createPageDocument({ pageId: "missing" }) }]
    };
    expect(() => createExtensionRegistry([missing])).toThrow(/缺少已注册区块/);
  });
});
