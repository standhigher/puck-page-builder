import { bestTrackBrandedExtension, bestTrackPageExtension, bestTrackSalesExtension } from "@standhigher/besttrack-page-extension";
import { createExtensionRegistry } from "@standhigher/puck-page-builder/extensions";

/** One deterministic Registry for template gallery, editor, preview and published pages. */
export const pageStudioRegistry = createExtensionRegistry([
  bestTrackPageExtension,
  bestTrackBrandedExtension,
  bestTrackSalesExtension
]);
