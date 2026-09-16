"use client";

import { Button, InlineStack, Text } from "@shopify/polaris";
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

type CheckState = "idle" | "checking" | "passed" | "failed";

export function SessionTokenCheck() {
  const shopify = useAppBridge();
  const [state, setState] = useState<CheckState>("idle");
  const [message, setMessage] = useState("尚未验证");

  const checkSession = async () => {
    setState("checking");
    try {
      const token = await shopify.idToken();
      const response = await fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json() as { authenticated?: boolean; shop?: string; reason?: string };
      if (!response.ok || !result.authenticated) throw new Error(result.reason ?? "session-token-rejected");
      setState("passed");
      setMessage(`已验证 ${result.shop ?? "当前店铺"}`);
      shopify.toast.show("Session Token 验证通过");
    } catch (error) {
      setState("failed");
      setMessage(error instanceof Error ? error.message : "session-token-check-failed");
    }
  };

  return <InlineStack gap="200" blockAlign="center">
    <Button size="slim" onClick={checkSession} loading={state === "checking"}>验证 Session Token</Button>
    <Text as="span" variant="bodySm" tone={state === "failed" ? "critical" : state === "passed" ? "success" : "subdued"}>{message}</Text>
  </InlineStack>;
}
