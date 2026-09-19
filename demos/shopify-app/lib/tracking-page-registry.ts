import { bestTrackDocumentValidationExtensions } from "@standhigher/besttrack-page-extension/validation";
import { createExtensionRegistry } from "@standhigher/puck-page-builder/extensions";

/** The final tracking templates accepted by the Demo's draft and publish APIs. */
export const trackingPageRegistry = createExtensionRegistry([
  ...bestTrackDocumentValidationExtensions
]);
