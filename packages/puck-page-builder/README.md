# @standhigher/puck-page-builder

`@standhigher/puck-page-builder` provides a React PageDocument editor, immutable extension registry and Web renderer for BestTrack page experiences.

> This is the package's only install and import name. `BestTrack Page Builder` is the product name; `packages/puck-page-builder` is only this repository's source directory.

## Installation

```bash
pnpm add @standhigher/puck-page-builder react react-dom @puckeditor/core @shopify/polaris @shopify/polaris-icons
```

The React, Puck and Polaris packages are peer dependencies and must be supplied by the host application.

## Web rendering

Import the package styles from the application's global stylesheet entry:

```tsx
import "@standhigher/puck-page-builder/styles.css";
```

Load a published `PageDocument` on the server, validate it at the storage boundary, assemble the business extensions, then render it:

```tsx
import { migratePageDocument } from "@standhigher/puck-page-builder";
import { WebRenderer } from "@standhigher/puck-page-builder/renderer";
import { createExtensionRegistry } from "@standhigher/puck-page-builder/extensions";

const migration = migratePageDocument(storedDocument);
if (!migration.success) throw new Error("Invalid published PageDocument");

const registry = createExtensionRegistry([bestTrackExtension]);
const page = <WebRenderer document={migration.data} registry={registry} />;
```

## Public entry points

| Import | Purpose |
| --- | --- |
| `@standhigher/puck-page-builder` | `PageDocument`, editor, document migration and base exports |
| `@standhigher/puck-page-builder/renderer` | `WebRenderer` |
| `@standhigher/puck-page-builder/extensions` | extension definitions and `createExtensionRegistry` |
| `@standhigher/puck-page-builder/schema` | schema-specific types and migration helpers |
| `@standhigher/puck-page-builder/styles.css` | Builder and Web renderer styles |

## Runtime and DataSource boundary

The package can register DataSources but does not automatically resolve `block.binding`, call a Live data source, or inject its result into `WebRenderer`. Implement authorization, data resolution, caching, error handling and temporary render-data projection in the host application's server-side Runtime. Do not persist tokens, credentials or resolved private data in `PageDocument`.

See the repository's [integration documentation](https://github.com/standhigher/puck-page-builder/tree/main/docs/integration) for the Web quick start, extension development and Runtime/DataSource guidance.

## Stability

The package is pre-1.0. Public APIs may evolve between minor releases; validate and migrate persisted documents at every read and publish boundary.
