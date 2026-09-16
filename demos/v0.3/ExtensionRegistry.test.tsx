import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fromEngineData, toEngineData } from "../../src/adapters/puck/page-document";
import { createPageDocumentPuckConfig } from "../../src/adapters/puck/page-document-config";
import { createExtensionRegistry, ExtensionRegistryError, type PageBuilderExtension } from "../../src/core/extensions";
import { createPageDocument } from "../../src/core/schema/page-document";
import { WebRenderer } from "../../src/renderer/web/WebRenderer";

const catalogExtension: PageBuilderExtension = {
  name: "acme.catalog",
  version: "1.0.0",
  blocks: [{
    type: "acme.catalog.notice",
    version: 1,
    label: "Catalog notice",
    category: "Acme",
    targets: ["web"],
    defaultProps: { message: "Catalog ready" },
    fields: { message: { field: "acme.catalog.text" } },
    render: { web: (props: Record<string, unknown>) => <p>{typeof props.message === "string" ? props.message : ""}</p> }
  }],
  fields: [{ type: "acme.catalog.text", component: () => null }],
  actions: [{ id: "acme.catalog.open", label: "Open catalog", position: "right", execute: () => undefined }],
  renderers: [{ id: "acme.catalog.web", target: "web", render: () => "catalog" }],
  dataSources: [{ key: "acme.catalog.query", mock: async () => ({}), live: async () => ({}) }],
  templates: [{ id: "acme.catalog.start", version: 1, name: "Catalog", target: "web", create: () => createPageDocument({ pageId: "catalog" }) }],
  slots: [{ id: "acme.catalog.toolbar", slot: "toolbar.right", component: () => null }]
};

describe("V0.3 Extension Registry", () => {
  it("orders dependencies, compiles all registry categories, slots, and hooks", () => {
    const onChange = vi.fn();
    const feature: PageBuilderExtension = {
      name: "acme.feature",
      version: "1.0.0",
      order: -10,
      dependsOn: ["acme.catalog"],
      actions: [{ id: "acme.feature.action", label: "Feature", position: "left", order: -1, execute: () => undefined }],
      hooks: { onChange }
    };
    const registry = createExtensionRegistry([feature, catalogExtension]);

    expect(registry.extensions.map((extension) => extension.name)).toEqual(["acme.catalog", "acme.feature"]);
    expect(registry.blocks.map((block) => block.type)).toEqual(["acme.catalog.notice"]);
    expect(registry.fields.map((field) => field.type)).toEqual(["acme.catalog.text"]);
    expect(registry.actions.map((action) => action.id)).toEqual(["acme.feature.action", "acme.catalog.open"]);
    expect(registry.renderers[0]?.id).toBe("acme.catalog.web");
    expect(registry.dataSources[0]?.key).toBe("acme.catalog.query");
    expect(registry.templates[0]?.id).toBe("acme.catalog.start");
    expect(registry.getSlot("toolbar.right")[0]?.id).toBe("acme.catalog.toolbar");
    expect(Object.isFrozen(registry)).toBe(true);
    registry.notifyChange(createPageDocument({ pageId: "changed" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate keys, missing dependencies, and dependency cycles explicitly", () => {
    const duplicate: PageBuilderExtension = { ...catalogExtension, name: "acme.duplicate", actions: [{ id: "acme.catalog.open", label: "Duplicate", position: "right", execute: () => undefined }] };
    expect(() => createExtensionRegistry([catalogExtension, duplicate])).toThrowError(ExtensionRegistryError);
    expect(() => createExtensionRegistry([{ name: "acme.needs", version: "1", dependsOn: ["acme.missing"] }])).toThrow(/缺少启用的依赖/);
    expect(() => createExtensionRegistry([
      { name: "acme.first", version: "1", dependsOn: ["acme.second"] },
      { name: "acme.second", version: "1", dependsOn: ["acme.first"] }
    ])).toThrow(/依赖存在循环/);
  });

  it("removes every contributed capability when an extension is disabled", () => {
    const registry = createExtensionRegistry([catalogExtension], { disabled: ["acme.catalog"] });
    expect(registry.extensions).toEqual([]);
    expect(registry.blocks).toEqual([]);
    expect(registry.fields).toEqual([]);
    expect(registry.actions).toEqual([]);
    expect(registry.templates).toEqual([]);
    expect(registry.getSlot("toolbar.right")).toEqual([]);
  });

  it("allows an independently registered business block through the adapter and renderer", () => {
    const registry = createExtensionRegistry([catalogExtension]);
    const document = createPageDocument({
      pageId: "catalog-page",
      blocks: [{ id: "notice-1", type: "acme.catalog.notice", version: 1, props: { message: "Extension block rendered" } }]
    });
    const engineData = toEngineData(document, registry);
    expect(engineData.content[0]).toMatchObject({ type: "acme.catalog.notice", props: { id: "notice-1" } });
    expect(fromEngineData(engineData, document, registry)).toEqual(document);
    expect(createPageDocumentPuckConfig(() => undefined, registry).components).toHaveProperty("acme.catalog.notice");

    render(<WebRenderer document={document} registry={registry} />);
    expect(screen.getByText("Extension block rendered")).toBeVisible();
  });
});
