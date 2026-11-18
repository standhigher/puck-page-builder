import type { Data } from "@puckeditor/core";
import { AppProvider } from "@shopify/polaris";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createExtensionRegistry } from "../../core/extensions";
import { createPageDocument } from "../../core/schema/page-document";
import { PageDocumentEditorShell, type PageDocumentEditorShellProps } from "./PageDocumentEditorShell";

// The canvas engine has layout dependencies that jsdom cannot measure; keep the
// real inspector with the section already selected.
vi.mock("@puckeditor/core", () => {
  const passthrough = ({ children, data }: { children: ReactNode; data?: Data }) => {
    if (data) puck.appState.data = data;
    return <>{children}</>;
  };
  const puck = {
    appState: { data: { root: { props: {} }, content: [] } as Data },
    dispatch: vi.fn(),
    refreshPermissions: vi.fn(),
    getSelectorForId: () => null,
    selectedItem: { props: { id: "section-1" } }
  };
  return {
    Puck: Object.assign(passthrough, { Layout: passthrough, Preview: () => null }),
    usePuck: () => puck
  };
});

const registry = createExtensionRegistry([{
  name: "acme.actions",
  version: "1.0.0",
  blocks: [{
    type: "acme.actions.section",
    version: 1,
    label: "Section",
    category: "Acme",
    targets: ["web"],
    defaultProps: { heading: "Carrier" },
    fields: { heading: { field: "acme.text", label: "Section heading", control: "text" } },
    render: { web: () => null }
  }]
}]);
const initialDocument = createPageDocument({ pageId: "inspector-actions", blocks: [{ id: "section-1", type: "acme.actions.section", version: 1, props: { heading: "Carrier" } }] });

function editor(props: Partial<PageDocumentEditorShellProps> = {}) {
  return <AppProvider i18n={{}}><PageDocumentEditorShell registry={registry} iframe={false} autoSave={false} initialDocument={initialDocument} {...props} /></AppProvider>;
}

describe("PageDocumentEditorShell inspector actions", () => {
  it("shows move, duplicate and delete actions in the inspector by default", async () => {
    render(editor());
    await screen.findByLabelText("Section heading");
    for (const name of ["Move up", "Move down", "Duplicate", "Delete"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("hides the inspector actions when the host turns them off", async () => {
    render(editor({ inspectorActions: false }));
    await screen.findByLabelText("Section heading");
    for (const name of ["Move up", "Move down", "Duplicate"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(document.querySelector(".pb-inspector-actions")).toBeNull();
  });
});
