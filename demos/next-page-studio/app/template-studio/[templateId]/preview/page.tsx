import { CustomTemplatePreview } from "../../../../components/CustomTemplatePreview";

export default async function PreviewTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <CustomTemplatePreview templateId={templateId} />;
}
