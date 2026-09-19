import type { PageDocumentEditorPolicy } from "@standhigher/puck-page-builder";

export type TemplateProfile = {
  id: string;
  summary: string;
  allowedBlockTypes: readonly string[];
  editorPolicy: PageDocumentEditorPolicy;
};

const readyToGoBlocks = [
  "besttrack.ready-to-go.query",
  "besttrack.ready-to-go.progress",
  "besttrack.ready-to-go.delivery",
  "besttrack.ready-to-go.recommendations"
];
const brandedBlocks = [
  "besttrack.branded.announcement",
  "besttrack.branded.tracking-experience",
  "besttrack.branded.recommendations",
  "besttrack.branded.quick-links",
  "besttrack.branded.blog"
];
const salesBlocks = [
  "besttrack.sales.announcement",
  "besttrack.sales.query",
  "besttrack.sales.order-items",
  "besttrack.sales.other-tracking",
  "besttrack.sales.service-cards",
  "besttrack.sales.product-categories",
  "besttrack.sales.recommendations"
];

function profile(id: string, summary: string, allowedBlockTypes: readonly string[]): TemplateProfile {
  return {
    id,
    summary,
    allowedBlockTypes,
    editorPolicy: {
      blocks: Object.fromEntries(allowedBlockTypes.map((type) => [type, { singleton: true }]))
    }
  };
}

const profiles = [
  profile("besttrack.ready-to-go", "开箱即用的标准物流查询体验。", readyToGoBlocks),
  profile("besttrack.branded", "强调品牌表达与售后内容的查询页。", brandedBlocks),
  profile("besttrack.sales", "将订单查询、商品与推荐组合成转化页。", salesBlocks)
];

export function templateProfile(templateId: string | undefined): TemplateProfile | undefined {
  return profiles.find((profile) => profile.id === templateId);
}

export const templateProfiles = profiles;
