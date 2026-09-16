import { PageDocumentPreview } from "../../../components/PageDocumentPreview";
import { demoPageDocument } from "../../../lib/page-document-demo";

export default function PageDocumentPreviewPage() {
  return <PageDocumentPreview initialDocument={demoPageDocument} />;
}
