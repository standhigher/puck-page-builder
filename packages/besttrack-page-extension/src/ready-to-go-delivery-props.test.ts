import { describe, expect, it } from "vitest";
import { createExtensionRegistry, validatePageDocumentWithRegistry } from "../../puck-page-builder/src/core/extensions";
import { createPageDocument, migratePageDocument, type JsonValue } from "../../puck-page-builder/src/core/schema/page-document";
import { bestTrackDocumentValidationExtensions } from "./validation";

const registry = createExtensionRegistry(bestTrackDocumentValidationExtensions);

function deliveryDocument(showCarrier?: JsonValue) {
  return createPageDocument({
    pageId: "carrier-visibility",
    templateId: "besttrack.ready-to-go",
    templateVersion: 1,
    blocks: [{
      id: "delivery",
      type: "besttrack.ready-to-go.delivery",
      version: 1,
      props: {
        heading: "Shipping Details",
        contentsHeading: "Package Contents",
        carrierHeading: "Carrier",
        ...(showCarrier === undefined ? {} : { showCarrier })
      }
    }]
  });
}

describe("Ready-to-go carrier visibility document contract", () => {
  it.each([undefined, true, false])("preserves %s through JSON storage and server validation", (showCarrier) => {
    const stored = JSON.parse(JSON.stringify(deliveryDocument(showCarrier)));
    const migration = migratePageDocument(stored);
    expect(migration.success).toBe(true);
    if (!migration.success) throw new Error("Expected a valid delivery document.");

    expect(validatePageDocumentWithRegistry(migration.data, registry)).toEqual([]);
    expect(migration.data.blocks[0]!.props.showCarrier).toBe(showCarrier);
    expect(migration.data.blocks[0]!.version).toBe(1);
    expect(migration.data.templateVersion).toBe(1);
  });

  it.each(["false", "true", "", 0, 1, null, [], {}] satisfies JsonValue[])("rejects a non-boolean value: %j", (showCarrier) => {
    const issues = validatePageDocumentWithRegistry(deliveryDocument(showCarrier), registry);
    expect(issues).toEqual([{ path: "blocks[0].props.showCarrier", message: "Show carrier must be a boolean." }]);
  });
});
