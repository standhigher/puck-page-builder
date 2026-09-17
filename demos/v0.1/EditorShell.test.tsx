import { AppProvider } from "@shopify/polaris";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createContext, useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditorShell } from "../../packages/puck-page-builder/src/editor/shell/EditorShell";

type MockPuckState = { config: { components: Record<string, { render: (props: Record<string, unknown>) => JSX.Element }> }; data: { content: { type: string; props: Record<string, unknown> }[] } };
const PuckContext = createContext<MockPuckState | null>(null);

vi.mock("@puckeditor/core", () => {
  const Puck = ({ children, config, data }: MockPuckState & { children: React.ReactNode }) => <PuckContext.Provider value={{ config, data }}><div className="Puck">{children}</div></PuckContext.Provider>;
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

function renderShell(props: Partial<React.ComponentProps<typeof EditorShell>> = {}) {
  return render(<AppProvider i18n={{}}><EditorShell iframe={false} {...props} /></AppProvider>);
}

describe("EditorShell V0.1.1", () => {
  it("keeps one block list when switching Blocks and Outline", () => {
    renderShell();
    expect(screen.getByTestId("blocks-view")).toHaveTextContent(/欢迎区块[\s\S]*物流查询[\s\S]*帮助文本/);
    fireEvent.click(screen.getByRole("button", { name: "结构" }));
    expect(screen.getByTestId("outline-view")).toHaveTextContent(/欢迎区块[\s\S]*物流查询[\s\S]*帮助文本/);
  });

  it("shares selection between Blocks, Outline, canvas and properties", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Select TrackingForm in canvas" }));
    expect(screen.getByTestId("property-panel")).toHaveTextContent("tracking-form-1");
    expect(screen.getAllByRole("button", { name: /^物流查询/ }).find((button) => button.hasAttribute("aria-pressed"))).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "结构" }));
    expect(screen.getAllByRole("button", { name: /^物流查询/ }).find((button) => button.hasAttribute("aria-pressed"))).toHaveAttribute("aria-pressed", "true");
  });

  it("opens and closes the independent component picker", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "添加模块" }));
    expect(screen.getByRole("dialog", { name: "添加模块" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "添加模块" })).not.toBeInTheDocument();
  });

  it("updates device and zoom presentation state", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Mobile" }));
    fireEvent.change(screen.getByLabelText("缩放"), { target: { value: "70" } });
    const canvas = screen.getByTestId("editor-shell").querySelector(".pb-canvas-frame");
    expect(canvas).toHaveAttribute("data-device", "mobile");
    expect(canvas).toHaveAttribute("data-zoom", "70");
  });

  it("keeps editor language and page locale independent", () => {
    renderShell();
    const inspector = screen.getByLabelText("Block properties");
    fireEvent.click(within(inspector).getByRole("tab", { name: "高级" }));
    fireEvent.change(screen.getByLabelText("Editor Language"), { target: { value: "en-US" } });
    expect(screen.getByLabelText("Editor Language")).toHaveValue("en-US");
    expect(screen.getByLabelText("Page Locale")).toHaveValue("en-US");
    fireEvent.change(screen.getByLabelText("Page Locale"), { target: { value: "zh-CN" } });
    expect(screen.getByLabelText("Editor Language")).toHaveValue("en-US");
    expect(screen.getByLabelText("Page Locale")).toHaveValue("zh-CN");
  });

  it("renders save and mock preview state without real requests", () => {
    vi.useFakeTimers();
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "预览" }));
    expect(screen.getByTestId("editor-shell")).toHaveAttribute("data-preview-mode", "mock-preview");
    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    act(() => vi.advanceTimersByTime(350));
    expect(screen.getByText("已保存")).toBeVisible();
    vi.useRealTimers();
  });

  it("keeps core actions available when narrow-layout panels start collapsed", () => {
    renderShell({ initialState: { isLeftRailOpen: false, isRightPanelOpen: false } });
    fireEvent.click(screen.getByRole("button", { name: "打开区块面板" }));
    fireEvent.click(screen.getByRole("button", { name: "打开属性面板" }));
    expect(screen.getByRole("button", { name: "添加模块" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "属性" })).toBeVisible();
  });

  it("uses the Builder tool rail and content/style/advanced inspector tabs", () => {
    renderShell();
    expect(screen.getByRole("navigation", { name: "编辑器工具" })).toBeVisible();
    const inspector = screen.getByLabelText("Block properties");
    expect(within(inspector).getByRole("tab", { name: "内容" })).toBeVisible();
    fireEvent.click(within(inspector).getByRole("tab", { name: "样式" }));
    expect(within(inspector).getByText(/Storefront 页面样式与编辑器 UI 隔离/)).toBeVisible();
  });
});
