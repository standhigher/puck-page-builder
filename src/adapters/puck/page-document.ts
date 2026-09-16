import type { Data } from "@puckeditor/core";
import { createPageDocument, type BlockNode, type PageDocument } from "../../core/schema/page-document";

const documentToPuckType: Record<string, string> = {
  "core.text": "Text",
  "core.image": "Image"
};

const puckToDocumentType = Object.fromEntries(Object.entries(documentToPuckType).map(([documentType, puckType]) => [puckType, documentType]));

function toEngineBlock(block: BlockNode) {
  const type = documentToPuckType[block.type];
  if (!type) throw new Error(`V0.2 不支持转换区块类型：${block.type}`);
  return { type, props: { id: block.id, ...block.props } };
}

export function toEngineData(document: PageDocument): Data {
  return {
    root: { ...document.root },
    content: document.blocks.map(toEngineBlock)
  };
}

export function fromEngineData(data: Data, base: PageDocument): PageDocument {
  const previousBlocks = new Map(base.blocks.map((block) => [block.id, block]));
  const blocks = data.content.flatMap((item) => {
    const type = puckToDocumentType[item.type];
    const id = typeof item.props.id === "string" ? item.props.id : null;
    if (!type || !id) return [];
    const previous = previousBlocks.get(id);
    const props = Object.fromEntries(Object.entries(item.props).filter(([key]) => key !== "id"));
    return [{
      id,
      type,
      version: previous?.version ?? 1,
      props: props as BlockNode["props"],
      ...(previous?.slots ? { slots: previous.slots } : {}),
      ...(previous?.binding ? { binding: previous.binding } : {})
    }];
  });

  return createPageDocument({ ...base, root: data.root as PageDocument["root"], blocks });
}
