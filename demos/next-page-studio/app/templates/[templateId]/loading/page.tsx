import { TemplateLoadingPreview } from "../../../../components/TemplateLoadingPreview";

export default async function TemplateLoadingPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <TemplateLoadingPreview templateId={templateId} />;
}
