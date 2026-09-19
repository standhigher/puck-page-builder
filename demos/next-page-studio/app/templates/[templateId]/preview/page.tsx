import { TemplatePreview } from "../../../../components/TemplatePreview";

export default async function TemplatePreviewPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <TemplatePreview templateId={templateId} />;
}
