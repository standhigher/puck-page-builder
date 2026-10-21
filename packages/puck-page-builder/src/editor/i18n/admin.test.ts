import { describe, expect, it } from "vitest";
import { createAdminI18n } from "./admin";

describe("createAdminI18n", () => {
  it("keeps the English catalog for en locales", () => {
    expect(createAdminI18n("en").t("publish")).toBe("Publish");
    expect(createAdminI18n("en-US").t("blocks")).toBe("Blocks");
    expect(createAdminI18n("en-GB").t("preview")).toBe("Preview");
    expect(createAdminI18n("en-GB").t("desktop")).toBe("Desktop");
  });

  it("keeps the Chinese catalog for zh locales, missing values, and unknown languages", () => {
    expect(createAdminI18n().t("publish")).toBe("发布");
    expect(createAdminI18n("zh-CN").t("blocks")).toBe("区块");
    expect(createAdminI18n("zh-Hans").t("mobile")).toBe("手机");
    expect(createAdminI18n("de-DE").t("preview")).toBe("正式预览");
  });

  it("uses European Portuguese chrome copy for pt-BR and pt-PT, and leaves other admin copy in Chinese", () => {
    for (const locale of ["pt-BR", "pt-PT", "pt", "PT-BR"]) {
      const i18n = createAdminI18n(locale);
      expect(i18n.locale).toBe("pt");
      expect(i18n.t("blocks")).toBe("Blocos");
      expect(i18n.t("desktop")).toBe("Computador");
      expect(i18n.t("tablet")).toBe("Tablet");
      expect(i18n.t("mobile")).toBe("Telemóvel");
      expect(i18n.t("preview")).toBe("Pré-visualização");
      expect(i18n.t("publish")).toBe("Publicar");
      expect(i18n.t("publishing")).toBe("A publicar…");
      expect(i18n.t("undo")).toBe("撤销");
    }
  });

  it("uses Spanish chrome copy for es locales, and leaves other admin copy in Chinese", () => {
    const i18n = createAdminI18n("es-ES");
    expect(i18n.locale).toBe("es");
    expect(i18n.t("blocks")).toBe("Bloques");
    expect(i18n.t("desktop")).toBe("Escritorio");
    expect(i18n.t("tablet")).toBe("Tablet");
    expect(i18n.t("mobile")).toBe("Móvil");
    expect(i18n.t("preview")).toBe("Vista previa");
    expect(i18n.t("publish")).toBe("Publicar");
    expect(i18n.t("publishing")).toBe("Publicando…");
    expect(i18n.t("undo")).toBe("撤销");
  });

  it("uses French chrome copy for fr locales, and leaves other admin copy in Chinese", () => {
    const i18n = createAdminI18n("fr-FR");
    expect(i18n.locale).toBe("fr");
    expect(i18n.t("blocks")).toBe("Blocs");
    expect(i18n.t("desktop")).toBe("Ordinateur");
    expect(i18n.t("tablet")).toBe("Tablette");
    expect(i18n.t("mobile")).toBe("Mobile");
    expect(i18n.t("preview")).toBe("Aperçu");
    expect(i18n.t("publish")).toBe("Publier");
    expect(i18n.t("publishing")).toBe("Publication…");
    expect(i18n.t("undo")).toBe("撤销");
  });
});
