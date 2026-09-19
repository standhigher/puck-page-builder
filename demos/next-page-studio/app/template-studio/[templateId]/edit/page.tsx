import { CustomTemplateEditor } from "../../../../components/CustomTemplateEditor";

export default async function EditTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <CustomTemplateEditor templateId={templateId} />;
}
