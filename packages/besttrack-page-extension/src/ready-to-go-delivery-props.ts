import type { ValidationIssue } from "@standhigher/puck-page-builder/runtime";

/** Missing values keep existing delivery documents compatible with the toggle. */
export function validateReadyToGoDeliveryProps(props: Record<string, unknown>): ValidationIssue[] {
  return props.showCarrier === undefined || typeof props.showCarrier === "boolean"
    ? []
    : [{ path: "props.showCarrier", message: "Show carrier must be a boolean." }];
}
