import en from "./admin-messages/en.json";
import zhCN from "./admin-messages/zh-CN.json";
import es from "./admin-messages/es.json";
import pt from "./admin-messages/pt.json";
import fr from "./admin-messages/fr.json";

export type BestTrackAdminLocale = "en" | "zh-CN" | "es" | "pt" | "fr";
export type BestTrackAdminMessageKey = keyof typeof en;
export type BestTrackAdminMessageValues = Readonly<Record<string, string | number>>;
export type BestTrackAdminI18n = {
  readonly locale: BestTrackAdminLocale;
  readonly t: (key: BestTrackAdminMessageKey, values?: BestTrackAdminMessageValues) => string;
};

// These catalogs describe editor UI only. No document or storefront locale is read or changed.
const catalogs = { en, "zh-CN": zhCN, es, pt, fr } satisfies Record<
  BestTrackAdminLocale,
  Record<BestTrackAdminMessageKey, string>
>;

export function resolveBestTrackAdminLocale(adminLocale?: string): BestTrackAdminLocale {
  const normalized = adminLocale?.trim().replace(/_/g, "-").toLowerCase();
  const language = normalized?.split("-")[0];
  if (language === "zh") return "zh-CN";
  if (language === "es" || language === "pt" || language === "fr") return language;
  return "en";
}

const instances = new Map<BestTrackAdminLocale, BestTrackAdminI18n>();

/** Package-owned editor copy. Hosts supply a language, never their translation dictionary. */
export function createBestTrackAdminI18n(adminLocale?: string): BestTrackAdminI18n {
  const locale = resolveBestTrackAdminLocale(adminLocale);
  const existing = instances.get(locale);
  if (existing) return existing;
  const i18n: BestTrackAdminI18n = Object.freeze({
    locale,
    t: (key: BestTrackAdminMessageKey, values?: BestTrackAdminMessageValues) => {
      const text = catalogs[locale][key] ?? en[key];
      return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        values?.[name] === undefined ? placeholder : String(values[name]),
      );
    },
  });
  instances.set(locale, i18n);
  return i18n;
}

/** Ready-to-go inspector metadata; defaultProps and persisted merchant content stay untouched. */
export function getReadyToGoEditorCopy(adminLocale?: string) {
  const { t } = createBestTrackAdminI18n(adminLocale);
  return {
    blockLabels: {
      "besttrack.ready-to-go.query": t("editor.blocks.query"),
      "besttrack.ready-to-go.progress": t("editor.blocks.progress"),
      "besttrack.ready-to-go.delivery": t("editor.blocks.delivery"),
      "besttrack.ready-to-go.recommendations": t("editor.blocks.recommendations"),
    },
    fieldLabels: {
      controls: {
        styleValue: t("editor.fields.style.styleValue"),
        limit: (max: number) => t("editor.fields.style.limit", { max }),
        invalidNumber: t("editor.fields.style.invalidNumber"),
        exceedsLimit: (max: number) => t("editor.fields.style.exceedsLimit", { max }),
      },
      query: {
        trackingTabLabel: t("editor.fields.query.trackingTabLabel"),
        orderTabLabel: t("editor.fields.query.orderTabLabel"),
        defaultTrackingNumber: t("editor.fields.query.defaultTrackingNumber"),
        defaultOrderNumber: t("editor.fields.query.defaultOrderNumber"),
        emailPlaceholder: t("editor.fields.query.emailPlaceholder"),
        submitLabel: t("editor.fields.query.submitLabel"),
        submitButtonColor: t("editor.fields.query.submitButtonColor"),
      },
      progress: { progressColor: t("editor.fields.progress.progressColor") },
      delivery: {
        heading: t("editor.fields.delivery.heading"),
        contentsHeading: t("editor.fields.delivery.contentsHeading"),
        carrierHeading: t("editor.fields.delivery.carrierHeading"),
        adImageUrl: t("customize.ad.imageLabel"),
        adImageHelp: t("customize.ad.imageHelp"),
        adLinkUrl: t("customize.ad.urlLabel"),
        adLinkHelp: t("customize.ad.helpText"),
      },
      recommendations: {
        heading: t("editor.fields.recommendations.heading"),
        products: t("editor.fields.recommendations.products"),
      },
      style: {
        backgroundColor: t("editor.fields.style.backgroundColor"),
        moduleRadius: t("editor.fields.style.moduleRadius"),
        imageRadius: t("editor.fields.style.imageRadius"),
        verticalSpacing: t("editor.fields.style.verticalSpacing"),
      },
    },
  };
}

export type ReadyToGoEditorCopy = ReturnType<typeof getReadyToGoEditorCopy>;

/** Copy for the host-rendered product picker; fetching and selection remain host-owned. */
export function getRecommendationEditorCopy(adminLocale?: string) {
  const { t } = createBestTrackAdminI18n(adminLocale);
  return {
    recommendation: {
      description: t("customize.recommendation.description"),
      selectAll: t("customize.recommendation.selectAll"),
      resourceName: {
        singular: t("customize.recommendation.resourceName.singular"),
        plural: t("customize.recommendation.resourceName.plural"),
      },
      headings: {
        product: t("customize.recommendation.headings.product"),
        inventory: t("customize.recommendation.headings.inventory"),
        status: t("customize.recommendation.headings.status"),
      },
      active: t("customize.recommendation.active"),
      noData: t("customize.recommendation.noData"),
    },
  };
}

export type RecommendationEditorCopy = ReturnType<typeof getRecommendationEditorCopy>;
