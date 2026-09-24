import { describe, expect, it } from "vitest";
import { brandedTemplatePolicy } from "./branded-definition";
import { bestTrackBrandedExtension } from "./branded-definition";
import { readyToGoTemplatePolicy } from "./ready-to-go-definition";
import { bestTrackPageExtension } from "./ready-to-go-definition";
import { salesTemplatePolicy } from "./sales-definition";
import { bestTrackSalesExtension } from "./sales-definition";
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
    expect(salesTemplatePolicy.enforcement).toBe("core-block-policy");
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.query")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.progress")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.delivery")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.delivery")?.fields).toMatchObject({
      heading: { validation: { maxLength: 52 } },
      contentsHeading: { validation: { maxLength: 52 } },
      carrierHeading: { validation: { maxLength: 52 } }
    });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.recommendations")?.policy).toMatchObject({ singleton: true });
    expect(bestTrackPageExtension.blocks?.find((block) => block.type === "besttrack.ready-to-go.recommendations")?.policy).not.toMatchObject({ allowDelete: false });
    expect(bestTrackBrandedExtension.blocks?.find((block) => block.type === "besttrack.branded.tracking-experience")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
    expect(bestTrackSalesExtension.blocks?.find((block) => block.type === "besttrack.sales.query")?.policy).toMatchObject({ required: true, singleton: true, allowDelete: false });
  });

  it("keeps query validation local and deterministic", () => {
    expect(isValidTrackingNumber("BT-2048-DEMO")).toBe(true);
    expect(isValidTrackingNumber("not valid!")).toBe(false);
    expect(isValidOrderNumber("ORDER-2048")).toBe(true);
    expect(isValidOrderNumber("x")).toBe(true);
    expect(isValidOrderEmail("customer@example.test")).toBe(true);
    expect(isValidOrderEmail("not-an-email")).toBe(false);
  });
});
