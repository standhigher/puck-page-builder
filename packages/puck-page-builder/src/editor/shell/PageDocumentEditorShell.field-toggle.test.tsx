import type { Data } from "@puckeditor/core";
import { AppProvider } from "@shopify/polaris";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createExtensionRegistry } from "../../core/extensions";
import { createPageDocument } from "../../core/schema/page-document";
import { PageDocumentEditorShell } from "./PageDocumentEditorShell";

// The canvas engine has layout dependencies that jsdom cannot measure; keep the
// real inspector and document history with the section already selected.
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
  name: "acme.toggle",
  version: "1.0.0",
  blocks: [{
    type: "acme.toggle.section",
    version: 1,
    label: "Section",
    category: "Acme",
    targets: ["web"],
    defaultProps: { heading: "Carrier" },
    fields: { heading: { field: "acme.text", label: "Section heading", control: "text", description: "When off, hide the section.", toggle: { prop: "showSection", label: "Show section", disablesField: true } } },
    render: { web: () => null }
  }]
}]);
const initialDocument = createPageDocument({ pageId: "field-toggle", blocks: [{ id: "section-1", type: "acme.toggle.section", version: 1, props: { heading: "Carrier" } }] });

function editor(onDocumentChange = vi.fn()) {
  return <AppProvider i18n={{}}><PageDocumentEditorShell registry={registry} iframe={false} autoSave={false} initialDocument={initialDocument} onDocumentChange={onDocumentChange} /></AppProvider>;
}

describe("PageDocumentEditorShell field heading toggle", () => {
  it("renders the switch in the field heading row and keeps the description under the label", async () => {
    render(editor());
    const toggle = await screen.findByRole("switch", { name: "Show section" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle.previousElementSibling).toHaveClass("pb-inspector-field__heading");
    expect(toggle.previousElementSibling).toHaveTextContent("Section heading");
    expect(toggle.previousElementSibling).toHaveTextContent("When off, hide the section.");
    expect(toggle.closest(".pb-inspector-field")).toContainElement(screen.getByLabelText("Section heading"));
  });

  it("writes the toggle prop and disables the field control while it is off", async () => {
    const onDocumentChange = vi.fn();
    render(editor(onDocumentChange));
    const toggle = await screen.findByRole("switch", { name: "Show section" });
    expect(screen.getByLabelText("Section heading")).not.toBeDisabled();

    fireEvent.click(toggle);
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0].props).toEqual({ heading: "Carrier", showSection: false });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Section heading")).toBeDisabled();

    fireEvent.click(toggle);
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0].props.showSection).toBe(true);
    expect(screen.getByLabelText("Section heading")).not.toBeDisabled();
  });
});
