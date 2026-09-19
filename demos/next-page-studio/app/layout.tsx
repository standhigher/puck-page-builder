/* eslint-disable react-refresh/only-export-components */
import "@puckeditor/core/dist/index.css";
import "@shopify/polaris/build/esm/styles.css";
import "@standhigher/puck-page-builder/styles.css";
import "./styles.css";
import type { Metadata } from "next";
import { RouteNavigator } from "../components/RouteNavigator";

export const metadata: Metadata = { title: "BestTrack Page Studio" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><RouteNavigator />{children}</body></html>;
}
