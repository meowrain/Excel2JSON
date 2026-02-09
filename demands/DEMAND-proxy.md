这是一个为您准备的 **v3.0 版本需求文档**。

这份文档的核心目标是**“收口”**：将之前零散开发的“前端代理 (Proxy)”功能正式集成到主流程中，确立 **“混合模式 (Hybrid Mode)”** 的架构策略。

即：**前端负责实时测试和预览（利用 Proxy），后端/脚本负责全量执行（利用 Job Bundle）。**

---

### 复制下面的内容发送给 Claude：

---

**Role:** 资深全栈架构师 (SvelteKit + TypeScript)

**Project Context:**
我们正在开发 "Excel2JSON ETL Blueprint Generator"。
目前我们已经具备了：

1. **前端:** Excel 解析、映射配置、JSON 预览。
2. **后端能力:** 一个 `/api/proxy` 端点 (SvelteKit Endpoint)，可以绕过 CORS 转发请求。
3. **输出:** `job_bundle.json` 用于给 Python 脚本跑全量数据。

**Current Goal (Phase 3 Integration):**
我们需要正式集成 `/api/proxy`，实现 **“所见即所得”** 的 API 调试体验。
用户在配置 API 字段时，可以直接点击“测试”，前端调用 Proxy 立即拿回数据并展示，确保配置无误后再导出。

### Phase 3: 在线调试与混合执行架构需求文档

#### 1. 核心架构策略：混合模式 (Hybrid Execution)

为了平衡**用户体验**与**系统性能**，我们采用以下策略：

* **调试/预览阶段 (Online Mode):**
* 使用 SvelteKit 后端代理 (`/api/proxy`)。
* **作用:** 让用户在配置界面就能实时验证 "URL 填得对不对"、"JSON Path 提取得对不对"。
* **限制:** 仅用于**单条数据**测试或**小批量 (前10条)** 预览。


* **生产/执行阶段 (Offline Mode):**
* 使用 `job_bundle.json` + Python 脚本。
* **作用:** 处理成千上万行数据的全量抓取和入库。
* **优势:** 无超时限制，无浏览器崩溃风险。



#### 2. UI/UX 交互升级

##### 2.1 API 配置面板 (Enrichment Config Modal)

在 `ApiConfigModal.svelte` 中增加 **"Test Connection" (测试连接)** 功能区。

* **输入区:** (已有的 URL, Method, Headers, Body 配置)
* **测试上下文 (Test Context):**
* 显示当前 Excel 的 **第一行数据** 作为测试样本。
* *示例:* `User ID: 101`, `Name: Alice`。
* 用户可以手动修改这些样本值来测试不同情况。


* **操作:** 点击 **[Test Request]** 按钮。
* **逻辑:**
1. 前端将 URL 模板中的 `{{Variables}}` 替换为测试样本值。
2. 发送 POST 请求给本站的 `/api/proxy`。
3. 等待响应。


* **反馈区:**
* **Status:** 显示 HTTP 状态码 (e.g., `200 OK`, `404 Not Found`)。
* **Response Preview:** 显示原始返回的 JSON (带语法高亮)。
* **Extracted Result:** 根据用户配置的 `Response Path` (e.g., `data.balance`)，显示最终提取到的值。
* *交互:* 如果提取结果为 `undefined`，高亮提示用户检查 Path 配置。



##### 2.2 主界面实时预览 (Enriched Preview)

在主界面的右侧 JSON 预览区，增加一个 **"Preview Enrichment" (预览增强数据)** 开关。

* **默认状态 (Off):** 仅展示静态映射后的数据（API 字段显示为 `null` 或占位符）。
* **开启状态 (On):**
* **限制:** 仅对前 **5 行** 数据生效。
* **加载:** 显示 Loading 骨架屏。
* **并发:** 并发调用 `/api/proxy` (限制并发数为 3)。
* **展示:** 成功获取后，JSON 预览中的相关字段会被真实数据填充并高亮显示。
* **警告:** 在开关旁显示小字提示 *"Live preview limited to first 5 rows to prevent API abuse."*



#### 3. 数据流与接口定义 (Data Flow)

##### 3.1 前端代理调用函数

封装一个通用的 `proxyFetch` 工具函数，用于前端组件调用：

```typescript
// src/lib/utils/proxy.ts

interface ProxyOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

export async function proxyFetch(options: ProxyOptions): Promise<any> {
  // 1. 调用我们自己的 SvelteKit 后端
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });

  if (!response.ok) {
    throw new Error(`Proxy Error: ${response.statusText}`);
  }

  return response.json();
}

```

##### 3.2 变量替换逻辑 (Template Interpolation)

确保前端和后端(Python)使用一致的变量替换逻辑。建议实现一个简单的 `renderTemplate` 函数：

```typescript
/**
 * 将 "https://api.com/users/{{id}}" 使用 { id: 123 } 替换为 "https://api.com/users/123"
 */
export function renderTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return context[key] !== undefined ? String(context[key]) : '';
  });
}

```

#### 4. 安全性与限流 (Security & Constraints)

为了防止 `/api/proxy` 被滥用或导致服务器卡死，请在服务端 (`src/routes/api/proxy/+server.ts`) 增加以下保护：

1. **超时控制:** 设置 `AbortController`，如果目标接口 10 秒未响应，强制中断并返回 504。
2. **错误屏蔽:** 如果目标接口返回敏感信息（如 Stack Trace），后端应进行脱敏处理后再返回给前端。

#### 5. 开发任务清单

1. **工具库:** 实现 `src/lib/utils/proxy.ts` 和 `renderTemplate`。
2. **组件升级:**
* 改造 `ApiConfigModal`：加入测试按钮和结果展示面板。
* 改造 `JsonPreview`：集成“实时预览”开关和并发请求逻辑。


3. **流程集成:** 确保在导出 `job_bundle.json` 时，不需要改动任何逻辑（导出依然是纯配置）。

---

### 给 AI 的提示 (Prompt Tip)

* **Focus on State:** 提醒 Claude 注意 Svelte 的状态管理。在测试 API 时，不要阻塞主 UI 的渲染。建议使用 `async/await` 配合局部 loading 状态变量。
* **Error Handling:** 强调错误处理。如果用户填的 API URL 是错的（比如 404），前端不应该报错崩溃，而是应该优雅地在“测试结果”面板里显示红色错误信息。

---

**请先实现 `src/lib/utils/proxy.ts` 和 `ApiConfigModal` 的测试功能。**