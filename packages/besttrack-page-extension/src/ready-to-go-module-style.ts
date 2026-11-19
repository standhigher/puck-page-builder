import type { CSSProperties } from "react";
import type { FieldConfig, ValidationIssue } from "@standhigher/puck-page-builder/runtime";

/** Radius and vertical spacing share one upper bound in the inspector and in saved documents. */
export const READY_TO_GO_MODULE_STYLE_LIMIT = 100;
export const READY_TO_GO_SHADOW_FIELD = "besttrack.ready-to-go.shadow-strength";
export const READY_TO_GO_DEFAULT_SHADOW_STRENGTH = "100";
export const READY_TO_GO_PIXEL_FIELD = "besttrack.ready-to-go.pixel";
export const READY_TO_GO_DEFAULT_MODULE_RADIUS = "16px";
export const READY_TO_GO_INPUT_RADIUS_FIELD = "besttrack.ready-to-go.input-radius";
export const READY_TO_GO_BUTTON_RADIUS_FIELD = "besttrack.ready-to-go.button-radius";
export const READY_TO_GO_INPUT_RADIUS_MAX = 24;
export const READY_TO_GO_BUTTON_RADIUS_MAX = 29;
// Preserve the previous visual default of approximately 8px while storing the new percentage value.
export const READY_TO_GO_DEFAULT_INPUT_RADIUS = "33.33%";
export const READY_TO_GO_DEFAULT_BUTTON_RADIUS = "27.59%";
export const READY_TO_GO_DEFAULT_VERTICAL_SPACING = "0px";

const IMAGE_RADIUS_BLOCK_TYPES: readonly string[] = ["besttrack.ready-to-go.delivery", "besttrack.ready-to-go.recommendations"];
const PX_VALUE = /^\d+(?:\.\d+)?(?:px)?$/i;
const MODULE_BACKGROUND = /^#[\da-f]{6}$/i;

function moduleColorLuminance(value: unknown): number | undefined {
  if (typeof value !== "string" || !MODULE_BACKGROUND.test(value)) return undefined;
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

/** Choose black or white by their contrast against the saved module background. */
export function readyToGoContrastTextColor(background: unknown): string | undefined {
  const luminance = moduleColorLuminance(background);
  if (luminance === undefined) return undefined;
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? "#ffffff" : "#000000";
}

export function readyToGoBlockHasImageRadius(type: string) {
  return IMAGE_RADIUS_BLOCK_TYPES.includes(type);
}

/** Field names stay identical to the earlier BestTrack host fields so saved page_config documents keep working. */
export function readyToGoModuleStyleFields(type: string): Record<"backgroundColor" | "moduleRadius" | "verticalSpacing", FieldConfig> & { imageRadius?: FieldConfig; inputRadius?: FieldConfig; buttonRadius?: FieldConfig; shadowStrength?: FieldConfig } {
  const pixel = (label: string): FieldConfig => ({ field: READY_TO_GO_PIXEL_FIELD, label, group: "Style" });
  return {
    backgroundColor: { field: "besttrack.ready-to-go.text", label: "Module background color", control: "color", group: "Style" },
    moduleRadius: pixel("Module radius (px)"),
    ...(type === "besttrack.ready-to-go.query" ? { inputRadius: { field: READY_TO_GO_INPUT_RADIUS_FIELD, label: "Input radius (%)", group: "Style" } } : {}),
    ...(type === "besttrack.ready-to-go.query" ? { buttonRadius: { field: READY_TO_GO_BUTTON_RADIUS_FIELD, label: "Button radius (%)", group: "Style" } } : {}),
    ...(type === "besttrack.ready-to-go.query" ? { shadowStrength: { field: READY_TO_GO_SHADOW_FIELD, label: "Shadow strength (%)", group: "Style" } } : {}),
    ...(readyToGoBlockHasImageRadius(type) ? { imageRadius: pixel("Image radius (px)") } : {}),
    verticalSpacing: pixel("Module vertical spacing (px)")
  };
}

export function readyToGoModuleStyleDefaults(type: string) {
  return {
    backgroundColor: "#ffffff",
    moduleRadius: type === "besttrack.ready-to-go.query" ? READY_TO_GO_DEFAULT_MODULE_RADIUS : "",
    ...(type === "besttrack.ready-to-go.query" ? { inputRadius: READY_TO_GO_DEFAULT_INPUT_RADIUS, buttonRadius: READY_TO_GO_DEFAULT_BUTTON_RADIUS, hideShadow: false, shadowStrength: READY_TO_GO_DEFAULT_SHADOW_STRENGTH } : {}),
    ...(readyToGoBlockHasImageRadius(type) ? { imageRadius: "8px" } : {}),
    verticalSpacing: type === "besttrack.ready-to-go.query" ? READY_TO_GO_DEFAULT_VERTICAL_SPACING : ""
  };
}

/** Empty or missing values inherit the template layout; anything else must be a non-negative pixel value within the limit. */
export function readyToGoPixelValueError(value: unknown, max = READY_TO_GO_MODULE_STYLE_LIMIT): "invalidNumber" | "exceedsLimit" | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return "invalidNumber";
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!PX_VALUE.test(trimmed)) return "invalidNumber";
  return Number.parseFloat(trimmed) > max ? "exceedsLimit" : undefined;
}

/** Radius percentages map to the maximum visible radius for each fixed-height control. Legacy px values remain readable. */
export function readyToGoRadiusPercent(value: unknown, maxRadius: number): number | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || readyToGoRadiusValueError(trimmed)) return undefined;
  if (/%$/.test(trimmed)) return Number.parseFloat(trimmed);
  return Math.min(100, Math.max(0, Number.parseFloat(trimmed) / maxRadius * 100));
}

export function readyToGoRadiusValue(value: unknown, maxRadius: number) {
  if (typeof value !== "string" || !value.trim() || readyToGoRadiusValueError(value)) return "";
  if (!value.trim().endsWith("%")) return readyToGoPixelValue(value);
  const percent = readyToGoRadiusPercent(value, maxRadius)!;
  return `${Number((maxRadius * percent / 100).toFixed(2))}px`;
}

export function readyToGoRadiusValueError(value: unknown): "invalidNumber" | "exceedsLimit" | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return "invalidNumber";
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/%$/.test(trimmed)) {
    const amount = Number.parseFloat(trimmed);
    return /^\d+(?:\.\d+)?%$/.test(trimmed) && amount <= 100 ? undefined : "exceedsLimit";
  }
  return readyToGoPixelValueError(trimmed);
}

/** Strength is stored as a unitless decimal string, like the range input value. */
export function readyToGoShadowStrengthValue(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim())) return undefined;
  const amount = Number(value.trim());
  return amount <= 100 ? amount : undefined;
}

export function readyToGoShadowStrength(props: Readonly<Record<string, unknown>>) {
  return readyToGoShadowStrengthValue(props.shadowStrength) ?? (props.hideShadow === true ? 0 : Number(READY_TO_GO_DEFAULT_SHADOW_STRENGTH));
}

export function readyToGoQueryShadow(props: Readonly<Record<string, unknown>>) {
  const strength = readyToGoShadowStrength(props);
  return strength === 0 ? "none" : `0 8px 24px rgba(0, 0, 0, ${Number((0.12 * strength / 100).toFixed(6))})`;
}

export function validateReadyToGoModuleStyle(type: string) {
  const names = ["moduleRadius", ...(type === "besttrack.ready-to-go.query" ? ["inputRadius", "buttonRadius"] : []), ...(readyToGoBlockHasImageRadius(type) ? ["imageRadius"] : []), "verticalSpacing"];
  return (props: Record<string, unknown>): ValidationIssue[] => [
    ...(type === "besttrack.ready-to-go.query" && props.shadowStrength !== undefined && props.shadowStrength !== "" && readyToGoShadowStrengthValue(props.shadowStrength) === undefined ? [{ path: "props.shadowStrength", message: "Shadow strength must be a number from 0 to 100." }] : []),
    ...(type === "besttrack.ready-to-go.query" && props.hideShadow !== undefined && typeof props.hideShadow !== "boolean" ? [{ path: "props.hideShadow", message: "Hide shadow must be a boolean." }] : []),
    ...names.flatMap((name) => {
      const error = type === "besttrack.ready-to-go.query" && (name === "inputRadius" || name === "buttonRadius")
        ? readyToGoRadiusValueError(props[name])
        : readyToGoPixelValueError(props[name]);
      if (!error) return [];
      return [{ path: `props.${name}`, message: error === "invalidNumber" ? "Enter a number, such as 12." : name === "inputRadius" || name === "buttonRadius" ? "Use a percentage from 0 to 100%." : `A maximum of ${READY_TO_GO_MODULE_STYLE_LIMIT}px is allowed.` }];
    })
  ];
}

export function readyToGoPixelValue(value: unknown) {
  if (typeof value !== "string" || !value.trim() || readyToGoPixelValueError(value)) return "";
  const trimmed = value.trim();
  return /px$/i.test(trimmed) ? trimmed : `${trimmed}px`;
}

/**
 * Inline CSS for the wrapper around one Ready-to-go block, shared by the canvas and the storefront.
 * Spacing pads the wrapper, so it adds to the block's own padding rather than replacing it.
 */
export function readyToGoModuleStyle(props: Record<string, unknown>, withImage: boolean): CSSProperties | undefined {
  const style: Record<string, string> = {};
  const background = typeof props.backgroundColor === "string" ? props.backgroundColor : "";
  if (MODULE_BACKGROUND.test(background)) {
    style.backgroundColor = background;
    style["--pb-color-background"] = background;
    style["--bt-module-text-color"] = readyToGoContrastTextColor(background)!;
  }
  const radius = readyToGoPixelValue(props.moduleRadius);
  if (radius) {
    style.borderRadius = radius;
    style.overflow = "hidden";
    // Product images read --pb-radius, so image blocks must not hand the module radius down to them.
    if (!withImage) style["--pb-radius"] = radius;
  }
  const imageRadius = withImage ? readyToGoPixelValue(props.imageRadius) : "";
  if (imageRadius) style["--pb-image-radius"] = imageRadius;
  const spacing = readyToGoPixelValue(props.verticalSpacing);
  if (spacing) {
    style.paddingTop = spacing;
    style.paddingBottom = spacing;
  }
  return Object.keys(style).length ? style as CSSProperties : undefined;
}
