import type { Data } from "@puckeditor/core";
import type { ExtensionRegistry } from "../../core/extensions";
import { createPageDocument, type BlockNode, type PageDocument } from "../../core/schema/page-document";

const documentToPuckType: Record<string, string> = {
  "core.text": "Text",
  "core.image": "Image"
};

const puckToDocumentType = Object.fromEntries(Object.entries(documentToPuckType).map(([documentType, puckType]) => [puckType, documentType]));

function toEngineBlock(block: BlockNode, registry?: ExtensionRegistry) {
  const type = documentToPuckType[block.type] ?? (registry?.getBlock(block.type) ? block.type : undefined);
  if (!type) throw new Error(`V0.2 不支持转换区块类型：${block.type}`);
  return { type, props: { id: block.id, ...block.props } };
}

export function toEngineData(document: PageDocument, registry?: ExtensionRegistry): Data {
  return {
    root: { props: { ...document.root } },
    content: document.blocks.map((block) => toEngineBlock(block, registry))
  };
}

export function fromEngineData(data: Data, base: PageDocument, registry?: ExtensionRegistry): PageDocument {
  const previousBlocks = new Map(base.blocks.map((block) => [block.id, block]));
  const blocks = data.content.flatMap((item) => {
    const type = puckToDocumentType[item.type] ?? (registry?.getBlock(item.type) ? item.type : undefined);
    const id = typeof item.props.id === "string" ? item.props.id : null;
    if (!type || !id) return [];
    const previous = previousBlocks.get(id);
    const props = Object.fromEntries(Object.entries(item.props).filter(([key]) => key !== "id"));
    return [{
      id,
      type,
      version: previous?.version ?? 1,
      props: props as BlockNode["props"],
      variant: previous?.variant ?? registry?.getBlock(type)?.defaultVariant ?? "default",
      style: previous?.style ?? {},
      ...(previous?.slots ? { slots: previous.slots } : {}),
      ...(previous?.binding ? { binding: previous.binding } : {})
    }];
  });

  // Puck V0.23 wraps root props in `{ props }`; PageDocument must never persist
  // that engine-specific wrapper.
  const root = typeof data.root === "object" && data.root !== null && "props" in data.root
    ? (data.root as { props: PageDocument["root"] }).props
    : data.root as PageDocument["root"];
  return createPageDocument({ ...base, root, blocks });
}
