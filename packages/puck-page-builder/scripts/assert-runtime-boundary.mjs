import { readFile } from "node:fs/promises";

const runtime = await readFile("dist/runtime.js", "utf8");
for (const forbidden of ["@puckeditor/core", "@shopify/polaris", "@shopify/polaris-icons", "@shopify/app-bridge"]) {
  if (runtime.includes(forbidden)) throw new Error(`Consumer runtime must not bundle ${forbidden}`);
}
