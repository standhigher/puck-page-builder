import { act, render } from "@testing-library/react";
import { useCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CanvasSelectionBridge } from "./PageDocumentEditorShell";

type Item = { type: string; props: { id: string } };
type Data = { root: { props: Record<string, never> }; content: Item[] };
type Selector = { zone: string; index: number } | null;

// Every dispatch publishes a new snapshot, as Puck does, so an unguarded effect loops.
const puck = vi.hoisted(() => {
  let data: Data = { root: { props: {} }, content: [] };
  let itemSelector: Selector = null;
  const listeners = new Set<() => void>();
  const actions: Array<{ type: string }> = [];
  const build = () => {
    const snapshotData = data;
    return {
      appState: { data: snapshotData },
      dispatch,
      refreshPermissions: () => undefined,
      selectedItem: itemSelector ? snapshotData.content[itemSelector.index] ?? null : null,
      getSelectorForId(id: string) {
        const index = snapshotData.content.findIndex((item) => item.props.id === id);
        return index >= 0 ? { zone: "root:default-zone", index } : undefined;
      }
    };
  };
  let snapshot = build();
  function dispatch(action: { type: "setData"; data: Data } | { type: "setUi"; ui: { itemSelector: Selector } }) {
    actions.push(action);
    if (action.type === "setData") data = action.data;
    else itemSelector = action.ui.itemSelector;
    snapshot = build();
    listeners.forEach((listener) => listener());
  }
  return {
    actions,
    dispatch,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get selectedId() { return snapshot.selectedItem?.props.id ?? null; },
    selectInCanvas(id: string | null) {
      const index = data.content.findIndex((item) => item.props.id === id);
      dispatch({ type: "setUi", ui: { itemSelector: index >= 0 ? { zone: "root:default-zone", index } : null } });
    },
    /** Changes Puck's selection without its own render, so the next host render observes it. */
    selectWithoutRender(id: string) {
      itemSelector = { zone: "root:default-zone", index: data.content.findIndex((item) => item.props.id === id) };
      snapshot = build();
    },
    reset() {
      data = { root: { props: {} }, content: [] };
      itemSelector = null;
      actions.length = 0;
      snapshot = build();
    }
  };
});

vi.mock("@puckeditor/core", async (importOriginal) => {
  const { useSyncExternalStore } = await import("react");
  return { ...(await importOriginal<object>()), usePuck: () => useSyncExternalStore(puck.subscribe, puck.getSnapshot) };
});

const recommendationId = "product-recommendations-4";
const block = (id: string): Item => ({ type: "test-block", props: { id } });
const precedingBlocks = [block("header-1"), block("tracking-2"), block("shipment-3")];
const documentData = (includeRecommendations: boolean): Data => ({
  root: { props: {} },
  content: includeRecommendations ? [...precedingBlocks, block(recommendationId)] : [...precedingBlocks]
});

function renderBridge(initialData: Data) {
  puck.reset();
  const confirmations: Array<string | null> = [];
  const host = {} as { requestedBlockId: string | null; setData: (data: Data) => void; setRequest: (id: string | null) => void };
  function Host() {
    const [data, setData] = useState(initialData);
    const [requestedBlockId, setRequest] = useState<string | null>(null);
    host.requestedBlockId = requestedBlockId;
    host.setData = setData;
    host.setRequest = setRequest;
    const onCanvasSelected = useCallback((id: string | null) => {
      confirmations.push(id);
      setRequest(null);
    }, []);
    return <CanvasSelectionBridge data={data as never} requestedBlockId={requestedBlockId} onCanvasSelected={onCanvasSelected} canvasMutationVersion={0} canvasResetVersion={0} permissionsVersion="test" />;
  }
  render(<Host />);
  return {
    confirmations,
    get requestedBlockId() { return host.requestedBlockId; },
    setData: (data: Data) => host.setData(data),
    setRequest: (id: string | null) => host.setRequest(id),
    update({ data, requestedBlockId }: { data?: Data; requestedBlockId?: string | null }) {
      act(() => {
        if (data) host.setData(data);
        if (requestedBlockId !== undefined) host.setRequest(requestedBlockId);
      });
    }
  };
}

const setUiCount = () => puck.actions.filter(({ type }) => type === "setUi").length;

describe("CanvasSelectionBridge", () => {
  it("selects a block that is deleted and re-added with the same generated ID repeatedly", () => {
    const host = renderBridge(documentData(true));
    host.update({ requestedBlockId: recommendationId });
    expect(puck.selectedId).toBe(recommendationId);
    expect(host.confirmations).toEqual([recommendationId]);

    for (let cycle = 0; cycle < 3; cycle++) {
      host.update({ data: documentData(false) });
      expect(puck.selectedId).toBeNull();

      host.update({ data: documentData(true), requestedBlockId: recommendationId });
      expect(puck.selectedId).toBe(recommendationId);
      expect(host.requestedBlockId).toBeNull();
      expect(host.confirmations).toEqual(Array(cycle + 2).fill(recommendationId));
    }
  });

  it("acknowledges a request for the already selected block without dispatching setUi again", () => {
    const host = renderBridge(documentData(true));
    host.update({ requestedBlockId: recommendationId });
    const previousSetUi = setUiCount();

    host.update({ requestedBlockId: recommendationId });

    expect(host.requestedBlockId).toBeNull();
    expect(puck.selectedId).toBe(recommendationId);
    expect(host.confirmations).toEqual([recommendationId, recommendationId]);
    expect(setUiCount()).toBe(previousSetUi);
  });

  it("keeps a pending new block request until Puck has its data, ignoring an older selection", () => {
    const host = renderBridge(documentData(false));
    // Puck still selects another block while the editor adds a recommendation; the new
    // block only reaches Puck through the setData effect of this same render.
    act(() => {
      puck.selectWithoutRender("shipment-3");
      host.setData(documentData(true));
      host.setRequest(recommendationId);
    });

    expect(puck.selectedId).toBe(recommendationId);
    expect(host.requestedBlockId).toBeNull();
    expect(host.confirmations).toEqual([recommendationId]);
  });

  it("reports the same canvas block again after the selection was cleared", () => {
    const host = renderBridge(documentData(true));
    act(() => puck.selectInCanvas(recommendationId));
    act(() => puck.selectInCanvas(null));
    act(() => puck.selectInCanvas(recommendationId));

    expect(host.confirmations).toEqual([recommendationId, recommendationId]);
  });

  it("keeps the already selected drag source selected after its index changes", () => {
    const host = renderBridge(documentData(true));
    host.update({ requestedBlockId: recommendationId });
    host.update({
      data: { root: { props: {} }, content: [block(recommendationId), ...precedingBlocks] },
      requestedBlockId: recommendationId
    });

    expect(puck.selectedId).toBe(recommendationId);
    expect(host.requestedBlockId).toBeNull();
    expect(host.confirmations).toEqual([recommendationId, recommendationId]);
  });

  it("selects a previously unselected drag source using its new index", () => {
    const host = renderBridge({ root: { props: {} }, content: [block("tracking-2"), block("shipment-3"), block(recommendationId), block("header-1")] });
    host.update({ requestedBlockId: recommendationId });
    host.update({
      data: { root: { props: {} }, content: [block("tracking-2"), block("header-1"), block("shipment-3"), block(recommendationId)] },
      requestedBlockId: "header-1"
    });

    expect(puck.selectedId).toBe("header-1");
    expect(host.requestedBlockId).toBeNull();
    expect(host.confirmations).toEqual([recommendationId, "header-1"]);
  });
});
