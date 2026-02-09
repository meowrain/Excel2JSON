

**Role:** 资深前端架构师 (Svelte 5 + TypeScript)

**Project Pivot (重大架构调整):**
我们将 "Excel2JSON Mapper" 升级为一个 **"ETL 配置生成器 (ETL Blueprint Generator)"**。
前端的任务是生成一个包含 **[源数据 + 处理逻辑]** 的 **Job Bundle (JSON 文件)**，用户将使用该文件配合 Python 脚本在后端执行实际的数据抓取和入库。

### Phase 2: ETL 配置生成器需求文档

#### 1. 项目概述

这是一个基于 Svelte 5 的单页应用。用户上传 Excel，配置字段映射规则（包含静态重命名和动态 API 获取规则），最后导出为一个标准化的 JSON 任务包 (`job_bundle.json`)。

#### 2. 用户界面与交互 (UI/UX)

##### 2.1 顶部工具栏

* **导入/导出配置:** 支持保存当前所有的映射规则。
* **导出任务包 (Export Job Bundle):** 這是核心操作。点击后下载 `job_bundle.json` 文件（包含数据+配置）。
* **提交设置 (Submission Settings):** 一个模态框，配置最终数据推送到哪里。
* `Target URL`: 最终数据接收接口 (e.g., `https://api.db.com/bulk-insert`).
* `Method`: POST / PUT.
* `Batch Size`: 批次大小 (默认 50).



##### 2.2 主体区域 (左右分栏)

* **左侧 (Source):** Excel 表格预览。
* **右侧 (Preview):** 静态映射后的 JSON 预览（仅展示前 20 条以保证性能）。

##### 2.3 核心功能：列配置 (Column Configuration)

在左侧表格区域，除了点击现有表头修改映射外，新增 **"添加计算列 (Add Computed Column)"** 功能。

**新增类型：`API_FETCH` (动态 API 字段)**
当用户选择此类型时，弹出一个详细配置面板：

1. **Target Key:** 最终生成的 JSON 字段名 (例如 `user_balance`)。
2. **Request URL (支持模板变量):**
* 允许使用 `{{ColumnName}}` 语法引用当前行的 Excel 数据。
* *示例:* `https://api.example.com/users/{{用户ID}}/detail`
* *UI 交互:* 输入框旁应有“插入变量”按钮，点击列出所有可用 Excel 表头。


3. **Request Method:** 下拉选择 `GET` (默认) 或 `POST`。
4. **Headers:** Key-Value 编辑器 (用于传 `Authorization`, `Content-Type` 等)。
5. **Request Body (仅 POST):**
* 多行文本域，支持 JSON 格式。
* 同样支持 `{{ColumnName}}` 模板变量替换。


6. **Response Extractor (取值路径):**
* 指定从接口返回的 JSON 中提取哪个字段。
* 支持 `lodash.get` 风格的点号路径。
* *示例:* 接口返回 `{ "data": { "balance": 100 } }`，用户填 `data.balance`。



#### 3. 核心输出：Job Bundle 数据结构

请严格按照以下 TypeScript 接口定义生成导出的 JSON 文件：

```typescript
// 1. 静态映射规则
interface StaticRule {
  type: 'static';
  source: string;       // Excel 原表头
  target: string;       // JSON 目标 Key
  dataType: 'string' | 'number' | 'boolean' | 'date';
  format?: string;      // 日期格式化字符串
}

// 2. 动态 API 获取规则 (本次新增核心)
interface ApiEnrichmentRule {
  type: 'api_fetch';
  target_key: string;   // JSON 目标 Key
  url_template: string; // "https://api.com/{{id}}"
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body_template?: string; // POST body 模板
  response_path: string;  // "data.result.value"
  fallback_value?: any;   // 默认值 (null/0)
}

// 3. 提交配置
interface SubmissionConfig {
  target_url: string;
  method: 'POST' | 'PUT';
  batch_size: number;
}

// 4. 最终导出的 Job Bundle 结构
interface JobBundle {
  meta: {
    version: string;
    generated_at: string;
  };
  config: {
    static_rules: StaticRule[];
    enrichment_rules: ApiEnrichmentRule[];
    submission: SubmissionConfig;
  };
  source_data: Record<string, any>[]; // 经过静态映射后的基础数据列表
}

```

#### 4. 开发任务清单

1. **Store 设计:** 更新 Svelte Store 以存储 `enrichmentRules` 和 `submissionConfig`。
2. **UI 组件:**
* 开发 `ApiConfigModal.svelte`: 用于录入 URL、Headers、Body 等复杂信息。
* 实现变量插入辅助功能 (点击列名自动插入 `{{...}}`)。


3. **导出逻辑:** 编写 `generateJobBundle` 函数。
* **步骤 1:** 根据 `static_rules` 转换 Excel 原始数据，生成基础 JSON 数组。
* **步骤 2:** 将基础数据、API 规则、提交配置组装成 `JobBundle` 格式。
* **步骤 3:** 触发浏览器下载 `job_bundle.json`。



#### 5. 特别说明 (给 AI 的提示)

* **No Runtime Fetch:** 前端代码 **不需要** 执行 `fetch` 去调用用户配置的 API（避免 CORS）。前端只负责把 URL 字符串保存到 JSON 里。
* **Template Validation:** 在 UI 上简单校验 URL 模板格式（检查是否包含 `{}`），但不做逻辑校验。
* **Preview Limitations:** 右侧预览仅展示静态映射的结果。对于 API 字段，可以在预览中显示一个占位符（如 `[Pending API Fetch]`）。

---

### 后续步骤 

Claude 完成这个前端代码后，你可以再发一条指令让它写对应的 Python 执行脚本：

> "前端已经完成了。现在请帮我写一个 Python 脚本 (`executor.py`)。它读取上面定义的 `job_bundle.json`，使用 http请求 执行 `enrichment_rules` 里的请求（注意替换 URL 中的 {{变量}}），最后把结果推送到 `submission` 定义的接口。"