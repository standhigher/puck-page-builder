/**
 * Compatibility metadata for template-aware hosts.
 *
 * Block cardinality and deletion are now enforced by the matching native
 * `BlockDefinition.policy` declarations. This remains an ergonomic template
 * overview for hosts that need to present the default composition.
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
  enforcement: "core-block-policy";
}>;

export function defineTemplatePolicy(templateId: string, displayName: string, defaultBlockOrder: readonly string[], lockedBlockTypes: readonly string[]): TemplatePolicy {
  return Object.freeze({
    templateId,
    displayName,
    defaultBlockOrder: Object.freeze([...defaultBlockOrder]),
    blocks: Object.freeze(defaultBlockOrder.map((blockType) => Object.freeze({ blockType, singleton: true, deletable: !lockedBlockTypes.includes(blockType) }))),
    enforcement: "core-block-policy"
  });
}
