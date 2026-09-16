import { AppProvider } from "@shopify/polaris";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createContext, useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageDocumentEditorShell } from "../../src/editor/shell/PageDocumentEditorShell";
import type { PageDocument } from "../../src/core/schema/page-document";

type MockPuckState = { config: { components: Record<string, { render: (props: Record<string, unknown>) => JSX.Element }> }; data: { content: { type: string; props: Record<string, unknown> }[] } };
const PuckContext = createContext<MockPuckState | null>(null);

// Puck's rendering engine is verified in V0.2. This keeps V0.4 interaction
// tests focused on the PageDocument editor's state and action boundaries.
vi.mock("@puckeditor/core", () => {
  const Puck = ({ children, config, data }: MockPuckState & { children: React.ReactNode }) => <PuckContext.Provider value={{ config, data }}><div>{children}</div></PuckContext.Provider>;
  Puck.Layout = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  function Preview() {
    const state = useContext(PuckContext)!;
    return <>{state.data.content.map((item) => {
      const Component = state.config.components[item.type].render;
      return <Component key={String(item.props.id)} {...item.props} />;
    })}</>;
  }
  Puck.Preview = Preview;
  return { Puck };
});

const document: PageDocument = {
  schemaVersion: 1,
  pageId: "v04-demo",
  target: "web",
  root: {},
  settings: { locale: "en", seoTitle: "Tracking page" },
  blocks: [
    { id: "text-1", type: "core.text", version: 1, props: { content: "First block" } },
    { id: "text-2", type: "core.text", version: 1, props: { content: "Second block" } }
  ]
};

function renderEditor(props: Partial<React.ComponentProps<typeof PageDocumentEditorShell>> = {}) {
  return render(<AppProvider i18n={{}}><PageDocumentEditorShell initialDocument={document} iframe={false} {...props} /></AppProvider>);
}

function blockIds() {
  return Array.from(screen.getByTestId("blocks-view").querySelectorAll(".pb-block-select")).map((button) => button.textContent?.match(/text-\d|core-text-\d/)?.[0]);
}

describe("PageDocumentEditorShell V0.4", () => {
  it("adds, duplicates, deletes, and reorders blocks as immutable PageDocument operations", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "添加区块" }));
    const dialog = screen.getByRole("dialog", { name: "添加区块" });
    fireEvent.click(within(dialog).getByRole("button", { name: "文本" }));
    expect(blockIds()).toEqual(["text-1", "text-2", "core-text-3"]);

    fireEvent.click(screen.getAllByRole("button", { name: "复制 文本" })[0]);
    expect(blockIds()).toEqual(["text-1", "core-text-4", "text-2", "core-text-3"]);
    fireEvent.click(screen.getAllByRole("button", { name: "删除 文本" })[0]);
    expect(blockIds()).toEqual(["core-text-4", "text-2", "core-text-3"]);

    fireEvent.click(screen.getAllByRole("button", { name: "下移" })[0]);
    expect(blockIds()).toEqual(["text-2", "core-text-4", "core-text-3"]);
  });

  it("supports native drag ordering and keeps selection shared with the inspector", () => {
    renderEditor();
    const rows = screen.getByTestId("blocks-view").querySelectorAll("article");
    const transfer = { setData: () => undefined, getData: () => "text-2", effectAllowed: "" };
    fireEvent.dragStart(rows[1], { dataTransfer: transfer });
    fireEvent.drop(rows[0], { dataTransfer: transfer });
    expect(blockIds()).toEqual(["text-2", "text-1"]);
    expect(screen.getByTestId("blocks-view").querySelectorAll(".pb-block-select")[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("tracks dirty history, restores properties with undo/redo, and handles editor shortcuts", () => {
    renderEditor();
    const field = screen.getByLabelText("文本内容");
    fireEvent.change(field, { target: { value: "Changed block" } });
    expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-dirty", "true");
    expect(field).toHaveValue("Changed block");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByLabelText("文本内容")).toHaveValue("First block");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(screen.getByLabelText("文本内容")).toHaveValue("Changed block");
  });

  it("provides desktop, tablet, mobile preview and English Admin copy independently of page locale", () => {
    renderEditor({ adminLocale: "en" });
    fireEvent.click(screen.getByRole("button", { name: "Mobile" }));
    expect(screen.getByTestId("page-document-editor").querySelector(".pb-canvas-frame")).toHaveAttribute("data-device", "mobile");
    expect(screen.getByRole("button", { name: "Add block" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveAttribute("aria-disabled", "true");
  });

  it.each(["loading", "empty", "error", "disabled"] as const)("renders the %s state without interactive controls", (loadState) => {
    renderEditor({ loadState });
    expect(screen.getByTestId("page-document-editor-state")).toHaveAttribute("data-editor-state", loadState);
    expect(screen.queryByTestId("page-document-editor")).not.toBeInTheDocument();
  });

  it("renders a success state and exposes document changes only through the callback", () => {
    const changed: PageDocument[] = [];
    renderEditor({ loadState: "success", onDocumentChange: (next) => changed.push(next) });
    expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-editor-state", "success");
    fireEvent.click(screen.getAllByRole("button", { name: "下移" })[0]);
    expect(changed.at(-1)?.blocks.map((block) => block.id)).toEqual(["text-2", "text-1"]);
  });

  it("only clears the leave-protection snapshot after a successful V0.5 draft save", async () => {
    const save = vi.fn<React.ComponentProps<typeof PageDocumentEditorShell>["onSave"]>().mockResolvedValue(undefined);
    renderEditor({ onSave: save });
    fireEvent.change(screen.getByLabelText("文本内容"), { target: { value: "Persist me" } });
    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ pageId: "v04-demo" })));
    await waitFor(() => expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-dirty", "false"));
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-dirty", "true");
  });
});
