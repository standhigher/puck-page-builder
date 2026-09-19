import { PageViewer } from "../../../../components/PageViewer";

export default async function PreviewPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  return <PageViewer pageId={pageId} mode="draft" />;
}
