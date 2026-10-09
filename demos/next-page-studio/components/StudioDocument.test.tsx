import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pageStudioRegistry } from "../lib/registry";
import { StudioDocument } from "./StudioDocument";

describe("Studio loading demo", () => {
  it("keeps Ready-to-go on the query loading status", async () => {
    const document = pageStudioRegistry.getTemplate("besttrack.ready-to-go")?.create();
    expect(document).toBeTruthy();
    render(<StudioDocument document={document!} holdLoading />);

    expect(await screen.findByRole("status", { name: "查询中..." })).toHaveTextContent("查询中...");
    expect(screen.getByText("You may also like...")).toBeInTheDocument();
  });
});
