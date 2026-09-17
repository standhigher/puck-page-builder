import "@puckeditor/core/dist/index.css";
import "@shopify/polaris/build/esm/styles.css";
import type { Metadata } from "next";
import { AppBridgeLoader } from "../components/AppBridgeLoader";
import "@standhigher/puck-page-builder/styles.css";
import "./styles.css";

export const metadata: Metadata = { title: "BestTrack Page Builder Demo" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";
  return <html lang="en">
    <head>
      <meta name="shopify-api-key" content={apiKey} />
    </head>
    <body><AppBridgeLoader>{children}</AppBridgeLoader></body>
  </html>;
}
