import { describe, expect, it } from "vitest";
import { createPageDocument } from "../schema/page-document";
import { createExtensionRegistry } from "./registry";
import { validatePageDocumentWithRegistry } from "./document-validation";

function createRegistry() {
  return createExtensionRegistry([{
    name: "acme.strict",
    version: "1.0.0",
    dataSources: [{ key: "acme.strict.lookup", async mock() { return {}; }, async live() { return {}; }, validateParams(params) { return typeof params.reference === "string" ? [] : [{ path: "reference", message: "reference is required" }]; } }],
    blocks: [{
      type: "acme.strict.card",
      version: 1,
      label: "Strict card",
      category: "Acme",
      targets: ["web"],
      defaultProps: { title: "Title", href: "https://example.com" },
      fields: {
        title: { field: "acme.strict.text", required: true, control: "text" },
        href: { field: "acme.strict.url", required: true, control: "url", validation: { allowRelativeUrl: false, allowedUrlProtocols: ["https:"] } }
      },
      render: { web: () => null }
    }]
  }]);
}

function createDocument() {
  return createPageDocument({
    pageId: "strict-page",
    blocks: [{ id: "strict-card", type: "acme.strict.card", version: 1, variant: "default", style: {}, props: { title: "Welcome", href: "https://example.com/welcome" } }]
  });
}

describe("registry document validation", () => {
  it("accepts declared props and rejects undeclared block data", () => {
    const registry = createRegistry();
    const document = createDocument();
    expect(validatePageDocumentWithRegistry(document, registry)).toEqual([]);

    document.blocks[0]!.props.unexpected = "not allowed";
    document.blocks[0]!.version = 2;
    expect(validatePageDocumentWithRegistry(document, registry)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "blocks[0].props.unexpected" }),
      expect.objectContaining({ path: "blocks[0].version" })
    ]));
  });

  it("accepts boolean field toggle props and rejects other values", () => {
    const registry = createExtensionRegistry([{
      name: "acme.toggle",
      version: "1.0.0",
      blocks: [{
        type: "acme.toggle.section",
        version: 1,
        label: "Section",
        category: "Acme",
        targets: ["web"],
        defaultProps: { heading: "Carrier" },
        fields: { heading: { field: "acme.text", control: "text", toggle: { prop: "showSection", label: "Show section" } } },
        render: { web: () => null }
      }]
    }]);
    const document = (showSection?: unknown) => createPageDocument({
      pageId: "toggle-page",
      blocks: [{ id: "section", type: "acme.toggle.section", version: 1, props: { heading: "Carrier", ...(showSection === undefined ? {} : { showSection: showSection as boolean }) } }]
    });
    for (const value of [undefined, true, false]) expect(validatePageDocumentWithRegistry(document(value), registry)).toEqual([]);
    for (const value of ["false", 0, null]) {
      expect(validatePageDocumentWithRegistry(document(value), registry)).toEqual([expect.objectContaining({ path: "blocks[0].props.showSection" })]);
    }
  });

  it("rejects unknown blocks, invalid URLs, and unauthorized data bindings", () => {
    const registry = createRegistry();
    const unknownDocument = createDocument();
    unknownDocument.blocks[0]!.type = "acme.strict.unknown";
    expect(validatePageDocumentWithRegistry(unknownDocument, registry)).toEqual(expect.arrayContaining([expect.objectContaining({ path: "blocks[0]", message: expect.stringContaining("未注册区块") })]));

    const document = createDocument();
    document.blocks[0]!.props.href = "/not-allowed";
    document.blocks[0]!.binding = { source: "acme.strict.lookup", params: {} };
    expect(validatePageDocumentWithRegistry(document, registry)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "blocks[0].props.href" }),
      expect.objectContaining({ path: "blocks[0].binding.source" }),
      expect.objectContaining({ path: "blocks[0].binding.params.reference" })
    ]));
  });
});
