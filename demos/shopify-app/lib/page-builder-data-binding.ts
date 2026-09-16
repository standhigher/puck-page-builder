import type { ExtensionRegistry } from "@standhigher/puck-page-builder/extensions";
import type { BlockNode, PageDocument } from "@standhigher/puck-page-builder";

export type DataSourceMode = "mock" | "live";

export class PageBuilderDataBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageBuilderDataBindingError";
  }
}

export function getBoundBlock(document: PageDocument, blockId: string): BlockNode {
  const block = document.blocks.find((candidate) => candidate.id === blockId);
  if (!block) throw new PageBuilderDataBindingError(`未找到绑定区块：${blockId}`);
  if (!block.binding) throw new PageBuilderDataBindingError(`区块未配置数据绑定：${blockId}`);
  return block;
}

/** Resolves a PageDocument block binding through the immutable extension Registry. */
export async function resolveBlockDataBinding(document: PageDocument, blockId: string, registry: ExtensionRegistry, mode: DataSourceMode): Promise<unknown> {
  const block = getBoundBlock(document, blockId);
  const source = registry.getDataSource(block.binding!.source);
  if (!source) throw new PageBuilderDataBindingError(`未注册的数据源：${block.binding!.source}`);

  const params = block.binding!.params ?? {};
  const issues = source.validateParams?.(params) ?? [];
  if (issues.length > 0) throw new PageBuilderDataBindingError(issues.map((issue) => `${issue.path}: ${issue.message}`).join("；"));
  return source[mode](params);
}
