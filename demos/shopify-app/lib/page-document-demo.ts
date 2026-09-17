import type { PageDocument } from "@standhigher/puck-page-builder";

export const demoPageDocument: PageDocument = {
  schemaVersion: 1,
  pageId: "tracking-page-demo",
  target: "web",
  templateId: "v0.2-minimal",
  templateVersion: 1,
  theme: {},
  root: { background: "#ffffff" },
  settings: { locale: "en", seoTitle: "Track your order" },
  blocks: [
    {
      id: "text-welcome",
      type: "core.text",
      version: 1,
      props: { content: "Track every order with confidence." },
      variant: "default",
      style: {}
    },
    {
      id: "image-delivery",
      type: "core.image",
      version: 1,
      props: {
        src: "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1200&q=80",
        alt: "Packages prepared for delivery"
      },
      variant: "default",
      style: {}
    }
  ]
};
