import { describe, expect, it } from "vitest";
import { createExtensionRegistry, ExtensionRegistryError, validateBlockPolicy, validateFieldValue } from ".";

describe("generic extension validation", () => {
  it("validates single-line, multi-line, length, URL, and color controls", () => {
    expect(validateFieldValue({ field: "", control: "text", required: true, validation: { minLength: 3, maxLength: 5 } }, "a\nbcdef").map((issue) => issue.message)).toEqual(expect.arrayContaining(["必须为单行文本。", "最多允许 5 个字符。"]))
    expect(validateFieldValue({ field: "", control: "textarea", validation: { minLength: 3 } }, "a\nb")).toEqual([])
    expect(validateFieldValue({ field: "", control: "url" }, "/tracking/123")).toEqual([])
    expect(validateFieldValue({ field: "", control: "url" }, "javascript:alert(1)")).toHaveLength(1)
    expect(validateFieldValue({ field: "", control: "color" }, "#005BD3")).toEqual([])
    expect(validateFieldValue({ field: "", control: "color" }, "blue")).toHaveLength(1)
  });

  it("rejects contradictory block cardinality policies at registration time", () => {
    expect(validateBlockPolicy({ required: true, maxInstances: 0 })).toMatch(/minInstances/);
    expect(() => createExtensionRegistry([{
      name: "acme.policy",
      version: "1.0.0",
      blocks: [{
        type: "acme.policy.block",
        version: 1,
        label: "Policy block",
        category: "Acme",
        targets: ["web"],
        defaultProps: {},
        fields: {},
        render: { web: () => null },
        policy: { singleton: true, minInstances: 2 }
      }]
    }])).toThrowError(ExtensionRegistryError);
  });
});
