import type { PageDocument } from "../core/schema/page-document";
import type { ValidationIssue } from "../core/extensions";

/** An opaque lease returned by the host's single-editor lock service. */
export type EditorSession = {
  id: string;
  expiresAt?: string;
};

export type EditorSessionState = "acquiring" | "active" | "locked" | "lost" | "readonly";

export type EditorSessionAcquireResult =
  | { state: "active"; session: EditorSession }
  | { state: "locked"; message?: string; editorName?: string }
  | { state: "readonly"; message?: string };

/**
 * Host-owned single-editor locking. The package never stores locks or makes
 * authorization decisions; it only coordinates the supplied lease.
 */
export type EditorSessionAdapter = {
  acquire(input: { pageId: string }): Promise<EditorSessionAcquireResult>;
  heartbeat?(input: { pageId: string; session: EditorSession }): Promise<void>;
  release?(input: { pageId: string; session: EditorSession }): Promise<void>;
  heartbeatIntervalMs?: number;
};

export type DraftSaveInput = {
  document: PageDocument;
  expectedRevision?: number;
  session?: EditorSession;
};

export type DraftSaveResult = {
  revision?: number;
  savedAt?: string;
};

/** Host-owned draft persistence used by manual and automatic saves. */
export type DraftPersistenceAdapter = {
  saveDraft(input: DraftSaveInput): Promise<DraftSaveResult | void>;
};

export type PublishActionInput = DraftSaveInput & {
  validationIssues: readonly ValidationIssue[];
};

export type PublishActionResult = {
  versionId?: string;
  versionLabel?: string;
  publishedAt?: string;
};

/** Host-owned publication transaction. It should validate and publish atomically. */
export type PublishAction = {
  publish(input: PublishActionInput): Promise<PublishActionResult | void>;
};

export type AssetStatus = "ready" | "processing" | "failed" | "missing";

export type AssetReference = {
  id: string;
  url: string;
  alt?: string;
  status?: AssetStatus;
};

/**
 * Opens a host-owned, shop-scoped asset picker. Upload, access checks, and
 * storage remain outside the editor package.
 */
export type AssetPickerAdapter = {
  selectAsset(input: {
    pageId: string;
    blockId: string;
    current?: Partial<AssetReference>;
  }): Promise<AssetReference | null>;
};

export type PagePublicationStatus = "unpublished" | "published";

/** Presentational data for the reusable page state card. */
export type PageStatus = {
  draftLabel?: string;
  publicationStatus: PagePublicationStatus;
  publishedVersionLabel?: string;
  lastSavedAt?: string;
  editingBy?: string;
};
