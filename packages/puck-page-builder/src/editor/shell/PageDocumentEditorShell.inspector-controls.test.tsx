import { AppProvider } from "@shopify/polaris";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createExtensionRegistry } from "../../core/extensions";
import type { FieldProps } from "../../core/extensions/types";
import { createPageDocument } from "../../core/schema/page-document";
import { PageDocumentEditorShell } from "./PageDocumentEditorShell";

// The canvas engine has layout dependencies that jsdom cannot measure; keep the
// real inspector with the section already selected.
vi.mock("@puckeditor/core", () => {
  const passthrough = ({ children }: { children: ReactNode }) => <>{children}</>;
  const puck = {
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

const fieldCalls: FieldProps[] = [];
function OwnLabelField(props: FieldProps) {
  fieldCalls.push(props);
  return <div data-testid="own-label-field"><span>{props.label} control</span></div>;
}
function PlainField(props: FieldProps) {
  return <input aria-label={props.label} readOnly value={typeof props.value === "string" ? props.value : ""} />;
}

const registry = createExtensionRegistry([{
  name: "acme.controls",
  version: "1.0.0",
  fields: [
    { type: "acme.own-label", component: OwnLabelField, rendersLabel: true },
    { type: "acme.plain", component: PlainField }
  ],
  blocks: [{
    type: "acme.controls.section",
    version: 1,
    label: "Section",
    category: "Acme",
    targets: ["web"],
    defaultProps: { buttonColor: "#111111", spacing: "16px", note: "" },
    fields: {
      buttonColor: { field: "acme.text", label: "Button color", control: "color", group: "Style" },
      spacing: { field: "acme.own-label", label: "Spacing (px)", group: "Style" },
      note: { field: "acme.plain", label: "Note", group: "Style" }
    },
    render: { web: () => null }
  }]
}]);

function editor(props: Record<string, unknown>, onDocumentChange = vi.fn(), adminLocale?: string) {
  const initialDocument = createPageDocument({ pageId: "inspector-controls", blocks: [{ id: "section-1", type: "acme.controls.section", version: 1, props: { buttonColor: "#111111", spacing: "", note: "", ...props } as Record<string, string> }] });
  return <AppProvider i18n={{}}><PageDocumentEditorShell registry={registry} iframe={false} autoSave={false} adminLocale={adminLocale} initialDocument={initialDocument} onDocumentChange={onDocumentChange} /></AppProvider>;
}

describe("PageDocumentEditorShell inspector controls", () => {
  it("shows color fields as a swatch with the label on the same row", async () => {
    render(editor({}));
    const swatch = await screen.findByLabelText("Button color");
    expect(swatch).toHaveAttribute("type", "color");
    const row = swatch.closest(".pb-inspector-field__color");
    expect(row).toHaveTextContent("Button color");
    expect(row).toHaveTextContent("#111111");
    expect(swatch.closest(".pb-inspector-field")?.querySelector(".pb-inspector-field__heading")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset to default" })).toBeNull();
  });

  it("resets a changed color to the block default", async () => {
    const onDocumentChange = vi.fn();
    render(editor({ buttonColor: "#ff0000" }, onDocumentChange));
    fireEvent.click(await screen.findByRole("button", { name: "Reset to default" }));
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0].props.buttonColor).toBe("#111111");
    expect(screen.queryByRole("button", { name: "Reset to default" })).toBeNull();
  });

  it("lets a custom field draw its own label and passes the localized reset label", async () => {
    fieldCalls.length = 0;
    render(editor({}, vi.fn(), "zh-CN"));
    const custom = await screen.findByTestId("own-label-field");
    const field = custom.closest(".pb-inspector-field");
    expect(field?.querySelector(".pb-inspector-field__heading")).toBeNull();
    expect(fieldCalls.at(-1)).toMatchObject({ label: "Spacing (px)", resetLabel: "恢复默认", defaultValue: "16px", value: "" });

    const plain = screen.getByLabelText("Note").closest(".pb-inspector-field");
    expect(plain?.querySelector(".pb-inspector-field__heading")).toHaveTextContent("Note");
  });
});
