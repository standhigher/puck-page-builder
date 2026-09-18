import { describe, expect, it } from "vitest";
import { brandedTemplatePolicy } from "./branded-definition";
import { readyToGoTemplatePolicy } from "./ready-to-go-definition";
import { salesTemplatePolicy } from "./sales-definition";
import { isValidOrderEmail, isValidOrderNumber, isValidTrackingNumber } from "./tracking-page-runtime";

describe("BestTrack template PRD compatibility metadata", () => {
  it("declares stable default order, singleton blocks, and host-enforced protected blocks", () => {
    expect(readyToGoTemplatePolicy.defaultBlockOrder).toEqual([
      "besttrack.ready-to-go.query",
      "besttrack.ready-to-go.progress",
      "besttrack.ready-to-go.delivery",
      "besttrack.ready-to-go.recommendations"
    ]);
    expect(brandedTemplatePolicy.blocks.find((block) => block.blockType === "besttrack.branded.tracking-experience")).toMatchObject({ singleton: true, deletable: false });
    expect(salesTemplatePolicy.blocks.find((block) => block.blockType === "besttrack.sales.query")).toMatchObject({ singleton: true, deletable: false });
    expect(salesTemplatePolicy.enforcement).toBe("host-compatibility");
  });

  it("keeps query validation local and deterministic", () => {
    expect(isValidTrackingNumber("BT-2048-DEMO")).toBe(true);
    expect(isValidTrackingNumber("not valid!")).toBe(false);
    expect(isValidOrderNumber("ORDER-2048")).toBe(true);
    expect(isValidOrderNumber("x")).toBe(false);
    expect(isValidOrderEmail("customer@example.test")).toBe(true);
    expect(isValidOrderEmail("not-an-email")).toBe(false);
  });
});
