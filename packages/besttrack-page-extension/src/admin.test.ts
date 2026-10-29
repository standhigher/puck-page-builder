import { describe, expect, it } from "vitest";
import {
  createBestTrackAdminI18n,
  getReadyToGoEditorCopy,
  getRecommendationEditorCopy,
  type BestTrackAdminMessageKey,
} from "./admin";
import en from "./admin-messages/en.json";
import zhCN from "./admin-messages/zh-CN.json";
import es from "./admin-messages/es.json";
import pt from "./admin-messages/pt.json";
import fr from "./admin-messages/fr.json";
import { bestTrackPageExtension, createReadyToGoTemplate } from "./ready-to-go-definition";

describe("BestTrack admin copy", () => {
  it.each([
    ["en-US", "en", "Query"],
    ["zh_CN", "zh-CN", "查询"],
    ["es-ES", "es", es["editor.blocks.query"]],
    ["PT-PT", "pt", pt["editor.blocks.query"]],
    ["fr-FR", "fr", fr["editor.blocks.query"]],
  ])("resolves %s and reads the complete package catalog", (input, locale, query) => {
    const i18n = createBestTrackAdminI18n(input);
    expect(i18n.locale).toBe(locale);
    expect(i18n.t("editor.blocks.query")).toBe(query);
    const catalog = { en, "zh-CN": zhCN, es, pt, fr }[locale];
    expect(catalog).toBeDefined();
    expect(Object.keys(catalog!).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as BestTrackAdminMessageKey[]) {
      expect(i18n.t(key)).toBe(catalog![key]);
      expect(i18n.t(key).trim().length).toBeGreaterThan(0);
      if (locale !== "zh-CN") expect(i18n.t(key)).not.toMatch(/[\u3400-\u9fff]/);
    }
  });

  it("falls back to English and reuses locale instances", () => {
    expect(createBestTrackAdminI18n().locale).toBe("en");
    expect(createBestTrackAdminI18n("de").t("editor.blocks.query")).toBe("Query");
    expect(createBestTrackAdminI18n("pt-PT")).toBe(createBestTrackAdminI18n("pt_BR"));
  });

  it("interpolates counts and text without interpreting content as templates", () => {
    expect(createBestTrackAdminI18n("en").t("editor.fields.style.limit", { max: 0 })).toBe("Limit 0");
    expect(createBestTrackAdminI18n("en").t("customize.recommendation.selectProduct", { title: "A {count}" })).toBe("Select A {count}");
    expect(createBestTrackAdminI18n("zh-CN").t("customize.recommendation.selectedCount", { count: 8 })).toBe("已选 8 个");
  });

  it("provides translated inspector metadata and picker copy without changing document content", () => {
    const before = createReadyToGoTemplate().create();
    const blockLabel = bestTrackPageExtension.blocks?.[0].label;
    const copy = getReadyToGoEditorCopy("zh-CN");
    expect(copy.blockLabels["besttrack.ready-to-go.query"]).toBe("查询");
    expect(copy.fieldLabels.query.submitLabel).toBe("按钮文案");
    expect(copy.fieldLabels.controls.exceedsLimit(100)).toBe("最多允许 100px。");
    expect(getRecommendationEditorCopy("fr").recommendation.noData).toBe(fr["customize.recommendation.noData"]);
    expect(bestTrackPageExtension.blocks?.[0].label).toBe(blockLabel);
    expect(createReadyToGoTemplate().create()).toEqual(before);
    expect(before.settings.locale).toBe("en");
    expect(before.blocks[0].props.submitLabel).toBe("Track Your Order");
  });
});
