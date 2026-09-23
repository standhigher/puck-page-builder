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

## Editor policies and field validation

Blocks can declare portable interaction and cardinality rules. `required` keeps at least one instance; `singleton` prevents a second instance. Hosts can supplement those declarations with `PageDocumentEditorShell`'s `policy` prop, including globally disabling add, delete, duplicate, or drag operations. Deletion through the packaged editor always opens its built-in confirmation dialog before changing the document.

```tsx
const notice = {
  // ...the normal BlockDefinition fields
  policy: { singleton: true, allowDuplicate: false },
  fields: {
    title: { field: "acme.text", control: "text", required: true, validation: { maxLength: 80 } },
    color: { field: "acme.color", control: "color" }
  }
};

<PageDocumentEditorShell
  initialDocument={document}
  registry={registry}
  policy={{ operations: { allowDrag: false } }}
/>
```

Built-in field controls are `text` (single line), `textarea` (multi-line), `url`, `color`, and `products`. `products` only renders the selected snapshot and a host picker button; Shopify search stays in the host `productPicker` adapter. Their validation runs in the editor before save or publish; custom fields may continue using a block's `validate` function. `validateFieldValue` is exported from `/extensions` when a host needs the same validation outside the editor.

Theme values remain deliberately token-based: template theme → page theme → variant theme → block style. A block resets an inherited token by setting its local token explicitly (for example `{ radius: "0" }`), so no incompatible persisted style-reset shape is needed.

## Runtime and DataSource boundary

The package can register DataSources but does not automatically resolve `block.binding`, call a Live data source, or inject its result into `WebRenderer`. Implement authorization, data resolution, caching, error handling and temporary render-data projection in the host application's server-side Runtime. Do not persist tokens, credentials or resolved private data in `PageDocument`.

See the repository's [integration documentation](https://github.com/standhigher/puck-page-builder/tree/main/docs/integration) for the Web quick start, extension development and Runtime/DataSource guidance.

## Stability

The package is pre-1.0. Public APIs may evolve between minor releases; validate and migrate persisted documents at every read and publish boundary.
