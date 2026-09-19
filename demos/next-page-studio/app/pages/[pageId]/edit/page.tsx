import { StudioEditor } from "../../../../components/StudioEditor";

export default async function EditPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  return <StudioEditor pageId={pageId} />;
}
