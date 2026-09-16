import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fromEngineData, toEngineData } from "../../src/adapters/puck/page-document";
import { createPageDocument, validatePageDocument, type PageDocument } from "../../src/core/schema/page-document";
import { WebRenderer } from "../../src/renderer/web/WebRenderer";

const document: PageDocument = createPageDocument({
  pageId: "page_123",
  templateId: "minimal",
  root: { background: "#fff" },
  settings: { locale: "en", seoTitle: "Track your order" },
  blocks: [
    { id: "text_1", type: "core.text", version: 1, props: { content: "Track your order" } },
    { id: "image_1", type: "core.image", version: 1, props: { src: "https://example.test/order.png", alt: "Order package" } }
  ]
});

describe("PageDocument V1", () => {
  it("applies V1 defaults and rejects Puck-shaped persistence data", () => {
    expect(createPageDocument({ pageId: "new-page" })).toEqual({ schemaVersion: 1, pageId: "new-page", target: "web", root: {}, blocks: [], settings: { locale: "en" } });
    expect(validatePageDocument(document)).toMatchObject({ success: true });
    expect(validatePageDocument({ root: {}, content: [] })).toMatchObject({ success: false });
  });

  it("round-trips Text and Image between PageDocument and Puck engine data", () => {
    const engine = toEngineData(document);
    expect(engine).toMatchObject({ root: { background: "#fff" }, content: [{ type: "Text", props: { id: "text_1", content: "Track your order" } }, { type: "Image", props: { id: "image_1", alt: "Order package" } }] });

    const changed = {
      ...engine,
      content: engine.content.map((block) => block.props.id === "text_1" ? { ...block, props: { ...block.props, content: "Updated tracking message" } } : block)
    };
    const restored = fromEngineData(changed, document);
    expect(restored.blocks[0].props.content).toBe("Updated tracking message");
    expect(JSON.stringify(restored)).not.toContain('"content":[');
    expect(validatePageDocument(restored)).toMatchObject({ success: true });
  });

  it("renders the same PageDocument through the minimal Web Renderer", () => {
    render(<WebRenderer document={document} />);
    expect(screen.getByText("Track your order")).toBeVisible();
    expect(screen.getByRole("img", { name: "Order package" })).toHaveAttribute("src", "https://example.test/order.png");
  });
});
