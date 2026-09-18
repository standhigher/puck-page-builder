/**
 * Compatibility metadata for template-aware hosts.
 *
 * The current Page Builder core registers template dependencies but does not
 * yet enforce block cardinality or deletion rules. Hosts may consume this
 * immutable declaration in their editor shell until those capabilities become
 * first-class core APIs.
 */
export type TemplateBlockPolicy = Readonly<{
  blockType: string;
  singleton: boolean;
  deletable: boolean;
}>;

export type TemplatePolicy = Readonly<{
  templateId: string;
  displayName: string;
  defaultBlockOrder: readonly string[];
  blocks: readonly TemplateBlockPolicy[];
  enforcement: "host-compatibility";
}>;

export function defineTemplatePolicy(templateId: string, displayName: string, defaultBlockOrder: readonly string[], lockedBlockTypes: readonly string[]): TemplatePolicy {
  return Object.freeze({
    templateId,
    displayName,
    defaultBlockOrder: Object.freeze([...defaultBlockOrder]),
    blocks: Object.freeze(defaultBlockOrder.map((blockType) => Object.freeze({ blockType, singleton: true, deletable: !lockedBlockTypes.includes(blockType) }))),
    enforcement: "host-compatibility"
  });
}
