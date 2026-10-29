import { describe, expect, it } from "vitest";
import { createAdminI18n } from "./admin";
import { validateFieldValue } from "../../core/extensions/validation";

describe("createAdminI18n", () => {
  it.each([
    ["en-US", "en", "Undo", "Style", "Select image"],
    ["zh_Hans", "zh-CN", "撤销", "样式", "选择图片"],
    ["es-ES", "es", "Deshacer", "Estilo", "Seleccionar imagen"],
    ["pt-PT", "pt", "Anular", "Estilo", "Selecionar imagem"],
    ["PT_BR", "pt", "Anular", "Estilo", "Selecionar imagem"],
    ["fr-FR", "fr", "Annuler", "Style", "Sélectionner une image"]
  ])("localizes the full editor UI for %s", (locale, normalized, undo, style, selectAsset) => {
    const i18n = createAdminI18n(locale);
    expect(i18n.locale).toBe(normalized);
    expect(i18n.t("undo")).toBe(undo);
    expect(i18n.t("style")).toBe(style);
    expect(i18n.t("selectAsset")).toBe(selectAsset);
    if (normalized !== "zh-CN") {
      for (const key of ["confirmDeleteTitle", "selectProductsFailed", "collapseRight", "validationRequired", "readonly"] as const) {
        expect(i18n.t(key)).not.toMatch(/\p{Script=Han}/u);
      }
    }
  });

  it.each([undefined, "", "de-DE"])("falls back to English for %s", (locale) => {
    expect(createAdminI18n(locale).t("publish")).toBe("Publish");
    expect(createAdminI18n(locale).locale).toBe("en");
  });

  it("interpolates values as literal text", () => {
    expect(createAdminI18n("fr").t("limit", { max: 52 })).toBe("Limite 52");
    expect(createAdminI18n("en").t("releaseToAdd", { label: "$& {name}" })).toBe("Release to add $& {name}");
  });

  it("localizes portable field validation only when requested by the UI", () => {
    const field = { field: "text", control: "text" as const, validation: { maxLength: 3 } };
    expect(validateFieldValue(field, "12345", createAdminI18n("fr").t)[0].message).toBe("Un maximum de 3 caractères est autorisé.");
    expect(validateFieldValue(field, "12345")[0].message).toBe("最多允许 3 个字符。");
  });
});
