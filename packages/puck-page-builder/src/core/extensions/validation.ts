import type { BlockPolicy, FieldConfig, ValidationIssue } from "./types";
import { isProductReference } from "./product-reference";

const hexColor = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

function stringLength(value: string) {
  return Array.from(value).length;
}

function isSafeUrl(value: string, config: FieldConfig) {
  if (value.startsWith("/")) return config.validation?.allowRelativeUrl !== false && !value.startsWith("//");
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if ((config.validation?.allowedUrlProtocols ?? ["https:", "http:"]).includes(url.protocol as "http:" | "https:")) return true;
    const editorRunsLocally = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "[::1]");
    return config.validation?.allowLocalhost === true && editorRunsLocally && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  } catch {
    return false;
  }
}

/** Validates the portable built-in controls without relying on browser-only APIs. */
export function validateFieldValue(config: FieldConfig, value: unknown): ValidationIssue[] {
  const control = config.control;
  if (!control && !config.required && !config.validation) return [];
  // Optional fields added after a document was created are absent rather than
  // malformed. Their renderer-level fallback keeps historical documents valid.
  if (value === undefined && !config.required) return [];
  if (control === "products") {
    if (!Array.isArray(value)) return [{ path: "", message: "必须是商品列表。" }];
    return value.flatMap((item, index) => isProductReference(item) ? [] : [{ path: String(index), message: "必须包含稳定的商品 ID。" }]);
  }
  if (typeof value !== "string") return [{ path: "", message: "必须是字符串。" }];
  const issues: ValidationIssue[] = [];
  if (config.required && value.trim().length === 0) issues.push({ path: "", message: "此字段为必填项。" });
  if (control === "text" && /[\r\n]/.test(value)) issues.push({ path: "", message: "必须为单行文本。" });
  if (config.validation?.minLength !== undefined && stringLength(value) < config.validation.minLength) issues.push({ path: "", message: `至少需要 ${config.validation.minLength} 个字符。` });
  if (config.validation?.maxLength !== undefined && stringLength(value) > config.validation.maxLength) issues.push({ path: "", message: `最多允许 ${config.validation.maxLength} 个字符。` });
  if (value && control === "url" && !isSafeUrl(value, config)) issues.push({ path: "", message: "必须是站内相对路径或允许的 HTTP(S) URL。" });
  if (value && control === "color" && !hexColor.test(value)) issues.push({ path: "", message: "必须是十六进制颜色，例如 #005BD3。" });
  return issues;
}

/** Returns a diagnostic for an invalid declaration, or `null` when it is usable. */
export function validateBlockPolicy(policy: BlockPolicy | undefined): string | null {
  if (!policy) return null;
  for (const key of ["minInstances", "maxInstances"] as const) {
    const value = policy[key];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) return `${key} 必须是大于或等于 0 的整数`;
  }
  const minimum = Math.max(policy.required ? 1 : 0, policy.minInstances ?? 0);
  const maximum = Math.min(policy.singleton ? 1 : Infinity, policy.maxInstances ?? Infinity);
  return minimum > maximum ? "minInstances 不能大于 maxInstances" : null;
}

export function mergeBlockPolicies(...policies: Array<BlockPolicy | undefined>): BlockPolicy {
  return Object.assign({}, ...policies);
}

export function minimumBlockInstances(policy: BlockPolicy | undefined) {
  return Math.max(policy?.required ? 1 : 0, policy?.minInstances ?? 0);
}

export function maximumBlockInstances(policy: BlockPolicy | undefined) {
  return Math.min(policy?.singleton ? 1 : Infinity, policy?.maxInstances ?? Infinity);
}
