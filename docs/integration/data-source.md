# DataSource 接入

DataSource 用于声明业务数据的 mock/live 获取方式。类型位于 `@standhigher/puck-page-builder/extensions`，结构如下：

```ts
type DataSourceDefinition<P, R> = {
  key: string;
  mock(params: P): Promise<R>;
  live(params: P): Promise<R>;
  validateParams?(params: P): ValidationIssue[];
};
```

区块在文档中通过 `binding` 引用数据源：

```json
{
  "id": "tracking-status-1",
  "type": "besttrack.tracking-status",
  "version": 1,
  "props": { "heading": "物流状态" },
  "binding": {
    "source": "besttrack.tracking.query",
    "params": { "trackingNumber": "BT-123456" }
  }
}
```

## 最小实现

```ts
import type { DataSourceDefinition } from "@standhigher/puck-page-builder/extensions";

type TrackingParams = { trackingNumber: string };
type TrackingResult = { status: string; updatedAt: string };

export const trackingSource: DataSourceDefinition<TrackingParams, TrackingResult> = {
  key: "besttrack.tracking.query",
  validateParams(params) {
    return /^[A-Za-z0-9-]{4,64}$/.test(params.trackingNumber)
      ? []
      : [{ path: "params.trackingNumber", message: "物流单号格式不正确" }];
  },
  async mock(params) {
    return { status: "In transit", updatedAt: "2026-01-01T00:00:00.000Z" };
  },
  async live(params) {
    // 仅服务端：调用业务服务，并从服务端环境读取凭据。
    return queryBestTrackServer(params);
  }
};
```

然后在 Extension 的 `dataSources` 注册它；可在 Block 的 `dataSources` 中声明该区块允许使用的 source key。当前 Registry 保存这些声明，但宿主 Runtime 仍应执行“区块与 source 是否匹配”的授权检查。

## 安全规则

- `binding.params` 是用户可编辑/可持久化 JSON，不可信且不应包含 secret。
- API key、Shopify session token、店铺后台凭据仅存在服务端环境或受控服务端会话中。
- `live` 不应从消费者浏览器直接请求私有上游服务。
- 先执行 `validateParams`，再发起 live 请求；记录 source key、耗时、结果类型和错误码，但不得记录敏感参数全文。
- Live 出错时返回受控错误或缓存数据；不要悄悄调用 `mock` 伪造生产结果。

## 当前 Demo 与生产的区别

Shopify Demo 的 Live 示例通过嵌入式 Admin Session Token 访问其服务端代理，适合验证 V0.6 流程。消费者 Web 页面通常没有该 Admin Session，应改由业务服务器凭自身服务凭据查询数据。Demo 中的绑定解析器可以作为参考，但它不是包的公开 Runtime API。

## 验收清单

- 非法 params 在请求上游前失败。
- 未注册 source、未授权 source 和 target 不匹配均有明确错误码。
- mock 与 live 结果结构一致。
- Live 仅在服务端执行，且无 secret 进入文档、HTML 或浏览器日志。
- 每种错误降级都可被产品和可观测平台识别。
