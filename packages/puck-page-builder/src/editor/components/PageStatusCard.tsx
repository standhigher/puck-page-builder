import { Badge, InlineStack, Text } from "@shopify/polaris";
import { createAdminI18n } from "../i18n/admin";
import type { EditorSessionState, PageStatus } from "../contracts";

export type PageStatusCardProps = {
  status: PageStatus;
  sessionState?: EditorSessionState;
  adminLocale?: string;
};

/** A small, host-data-driven summary suitable for an editor header or page list. */
export function PageStatusCard({ status, sessionState, adminLocale }: PageStatusCardProps) {
  const i18n = createAdminI18n(adminLocale);
  const publicationTone = status.publicationStatus === "published" ? "success" : "attention";
  const sessionLabel = sessionState === "locked"
    ? i18n.t("editingBy", { name: status.editingBy ?? i18n.t("someoneElse") })
    : sessionState === "lost"
      ? i18n.t("lockLost")
      : status.editingBy
        ? i18n.t("editingBy", { name: status.editingBy })
        : undefined;

  return <div className="pb-page-status-card" data-testid="page-status-card" data-publication-status={status.publicationStatus} data-session-state={sessionState}>
    <InlineStack gap="150" blockAlign="center" wrap>
      <Badge tone={publicationTone}>{i18n.t(status.publicationStatus === "published" ? "published" : "unpublished")}</Badge>
      {status.draftLabel ? <Text as="span" variant="bodySm" tone="subdued">{status.draftLabel}</Text> : null}
      {status.publishedVersionLabel ? <Text as="span" variant="bodySm" tone="subdued">{status.publishedVersionLabel}</Text> : null}
      {sessionLabel ? <Badge tone={sessionState === "lost" ? "critical" : "attention"}>{sessionLabel}</Badge> : null}
    </InlineStack>
    {status.lastSavedAt ? <Text as="p" variant="bodySm" tone="subdued">{i18n.t("lastSaved", { date: status.lastSavedAt })}</Text> : null}
  </div>;
}
