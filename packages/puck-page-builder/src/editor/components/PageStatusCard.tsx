import { Badge, InlineStack, Text } from "@shopify/polaris";
import type { EditorSessionState, PageStatus } from "../contracts";

export type PageStatusCardProps = {
  status: PageStatus;
  sessionState?: EditorSessionState;
};

/** A small, host-data-driven summary suitable for an editor header or page list. */
export function PageStatusCard({ status, sessionState }: PageStatusCardProps) {
  const publicationTone = status.publicationStatus === "published" ? "success" : "attention";
  const sessionLabel = sessionState === "locked"
    ? `${status.editingBy ?? "其他人"}正在编辑`
    : sessionState === "lost"
      ? "编辑锁已失效"
      : status.editingBy
        ? `${status.editingBy}正在编辑`
        : undefined;

  return <div className="pb-page-status-card" data-testid="page-status-card" data-publication-status={status.publicationStatus} data-session-state={sessionState}>
    <InlineStack gap="150" blockAlign="center" wrap>
      <Badge tone={publicationTone}>{status.publicationStatus === "published" ? "线上" : "未发布"}</Badge>
      {status.draftLabel ? <Text as="span" variant="bodySm" tone="subdued">{status.draftLabel}</Text> : null}
      {status.publishedVersionLabel ? <Text as="span" variant="bodySm" tone="subdued">{status.publishedVersionLabel}</Text> : null}
      {sessionLabel ? <Badge tone={sessionState === "lost" ? "critical" : "attention"}>{sessionLabel}</Badge> : null}
    </InlineStack>
    {status.lastSavedAt ? <Text as="p" variant="bodySm" tone="subdued">最后保存：{status.lastSavedAt}</Text> : null}
  </div>;
}
