import type { PageBuilderExtension } from "@standhigher/puck-page-builder/runtime";

/**
 * V0.6.1 owns only the package boundary. Product blocks and templates are
 * intentionally deferred to their separately accepted V0.7.x versions.
 */
export const bestTrackPageExtension: PageBuilderExtension = Object.freeze({
  name: "besttrack.page",
  version: "0.6.1"
});
