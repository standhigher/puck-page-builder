import type { BlockDefinition, BlockOperation, BlockPolicy, EditorOperationPolicy } from "../core/extensions";
import { maximumBlockInstances, mergeBlockPolicies, minimumBlockInstances } from "../core/extensions";
import type { BlockNode, PageDocument } from "../core/schema/page-document";

/** Host-level rules that supplement policies declared by extension blocks. */
export type PageDocumentEditorPolicy = {
  operations?: EditorOperationPolicy;
  blocks?: Record<string, BlockPolicy>;
};

function operationEnabled(operation: BlockOperation, policy: PageDocumentEditorPolicy | undefined, blockPolicy: BlockPolicy) {
  const key = `allow${operation[0].toUpperCase()}${operation.slice(1)}` as keyof EditorOperationPolicy;
  return policy?.operations?.[key] !== false && blockPolicy[key as keyof BlockPolicy] !== false;
}

export function resolvedBlockPolicy(type: string, definition: Pick<BlockDefinition, "policy"> | undefined, policy: PageDocumentEditorPolicy | undefined) {
  return mergeBlockPolicies(definition?.policy, policy?.blocks?.[type]);
}

function blockCount(blocks: readonly BlockNode[], type: string) {
  return blocks.filter((block) => block.type === type).length;
}

export function canAddBlock(type: string, blocks: readonly BlockNode[], definition: Pick<BlockDefinition, "policy"> | undefined, policy: PageDocumentEditorPolicy | undefined) {
  const blockPolicy = resolvedBlockPolicy(type, definition, policy);
  return operationEnabled("add", policy, blockPolicy) && blockCount(blocks, type) < maximumBlockInstances(blockPolicy);
}

export function canDeleteBlock(block: BlockNode | null | undefined, blocks: readonly BlockNode[], definition: Pick<BlockDefinition, "policy"> | undefined, policy: PageDocumentEditorPolicy | undefined) {
  if (!block) return false;
  const blockPolicy = resolvedBlockPolicy(block.type, definition, policy);
  return operationEnabled("delete", policy, blockPolicy) && blockCount(blocks, block.type) > minimumBlockInstances(blockPolicy);
}

export function canDuplicateBlock(block: BlockNode | null | undefined, blocks: readonly BlockNode[], definition: Pick<BlockDefinition, "policy"> | undefined, policy: PageDocumentEditorPolicy | undefined) {
  if (!block) return false;
  const blockPolicy = resolvedBlockPolicy(block.type, definition, policy);
  return operationEnabled("duplicate", policy, blockPolicy) && canAddBlock(block.type, blocks, definition, policy);
}

export function canDragBlock(block: BlockNode | null | undefined, definition: Pick<BlockDefinition, "policy"> | undefined, policy: PageDocumentEditorPolicy | undefined) {
  if (!block) return false;
  return operationEnabled("drag", policy, resolvedBlockPolicy(block.type, definition, policy));
}

/** Reject Puck-originated adds, removals and reorders that bypass editor controls. */
export function canApplyCanvasDocument(previous: PageDocument, next: PageDocument, getDefinition: (type: string) => Pick<BlockDefinition, "policy"> | undefined, policy: PageDocumentEditorPolicy | undefined) {
  const previousById = new Map(previous.blocks.map((block) => [block.id, block]));
  const nextById = new Map(next.blocks.map((block) => [block.id, block]));
  for (const block of next.blocks) {
    const previousBlock = previousById.get(block.id);
    if (previousBlock && previousBlock.type !== block.type) return false;
  }
  for (const block of next.blocks) {
    if (!previousById.has(block.id) && !canAddBlock(block.type, previous.blocks, getDefinition(block.type), policy)) return false;
  }
  for (const block of previous.blocks) {
    if (!nextById.has(block.id) && !canDeleteBlock(block, previous.blocks, getDefinition(block.type), policy)) return false;
  }
  const types = new Set([...previous.blocks, ...next.blocks].map((block) => block.type));
  for (const type of types) {
    const definition = getDefinition(type);
    const blockPolicy = resolvedBlockPolicy(type, definition, policy);
    const nextCount = blockCount(next.blocks, type);
    if (nextCount > maximumBlockInstances(blockPolicy) || nextCount < minimumBlockInstances(blockPolicy)) return false;
  }
  if (previous.blocks.length === next.blocks.length && previous.blocks.every((block) => nextById.has(block.id))) {
    for (let index = 0; index < previous.blocks.length; index += 1) {
      if (previous.blocks[index]?.id !== next.blocks[index]?.id && !canDragBlock(previous.blocks[index], getDefinition(previous.blocks[index]!.type), policy)) return false;
    }
  }
  return true;
}
