

这次更新加入了 **“字典映射 (Dictionary Mapping)”** 功能，允许用户对有限的枚举值进行转换（如“是/否”转“Y/N”）。

我特别在文档中强调了**“自动扫描”**功能——让 UI 自动读取 Excel 列中的前几十行去重数据，自动列出所有可能的选项，用户只需要填右边的目标值即可，极大提升体验。

---

### 复制下面的内容发送给 Claude：

---

**Role:** 资深前端架构师 (Svelte 5 + TypeScript)

**Project Context:**
我们正在开发 "Excel2JSON ETL Blueprint Generator"。
前端负责解析 Excel、配置映射规则（含静态重命名、字典转换、动态 API）、生成预览，并最终导出包含 **[处理后的基础数据 + API 执行逻辑]** 的 `job_bundle.json`。

**Current Task:**
我们需要在 **v2.0 (API Enrichment)** 的基础上，新增 **v2.1 (Dictionary/Enum Mapping)** 功能。

### Phase 2.1: 字典映射与高级 ETL 配置需求文档

#### 1. 核心功能变更

在静态字段映射（Static Mapping）阶段，新增 **"值映射 (Value Map)"** 功能。

* **场景:** Excel 中某列是状态词（如 "开/关", "男/女"），目标 JSON 需要代码（如 `1/0`, `M/F`）。
* **逻辑:** 解析 Excel -> **字典替换** -> 类型转换 -> 生成基础 JSON -> (后续由 Python 处理 API).

#### 2. 用户界面与交互 (UI/UX)

##### 2.1 列配置面板升级

点击 Excel 表头配置时，除了修改 `Target Key` 和 `Data Type`，新增一个 **"Value Mapping" (值映射)** 开关/折叠面板。

**面板内容：**

1. **自动扫描 (Auto-Scan):**
* UI 自动读取该列的前 50 行数据，提取所有**唯一值 (Unique Values)**。
* 显示一个“映射表”：左侧是 `Source Value` (Excel 原值)，右侧是 `Target Value` (输入框)。


2. **手动添加:** 允许用户手动增加新的映射对（防止前 50 行没覆盖到所有情况）。
3. **默认值 (Fallback):**
* 如果单元格的值不在映射表中，怎么处理？
* 选项: `Keep Original` (保留原值) / `Set to Null` / `Custom Value` (自定义默认值)。



##### 2.2 预览逻辑 (Preview Logic)

* 右侧 JSON 预览必须**实时反映**字典映射的结果。
* *示例:* 用户在左侧把 "是" 映射为 `true` (Boolean)，右侧预览中原本的 "是" 应立即变为 `true`。

#### 3. 核心数据结构 (Updated Interfaces)

请更新 TypeScript 接口以支持新的映射逻辑：

```typescript
// 字典映射项
interface ValueMapItem {
  source: string | number; // Excel 里的原始值 (e.g., "是")
  target: any;             // JSON 里的目标值 (e.g., true, "Y", 1)
}

// 静态映射规则 (升级版)
interface StaticRule {
  type: 'static';
  source_column: string;      // Excel 原表头
  target_key: string;         // JSON 目标 Key
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'array'; // 目标类型
  
  // v2.1 新增: 字典映射配置
  use_dictionary: boolean;    // 是否启用字典映射
  value_mapping?: ValueMapItem[]; 
  mapping_fallback?: 'keep' | 'null' | any; // 没匹配到时的默认值
  
  // v2.0 已有
  format?: string;            // 日期格式
  separator?: string;         // 数组分隔符
}

// 动态 API 规则 (保持 v2.0 不变)
interface ApiEnrichmentRule {
  type: 'api_fetch';
  target_key: string;
  url_template: string;       // "https://api.com/{{id}}"
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body_template?: string;
  response_path: string;      // "data.result"
}

// 提交配置 (保持 v2.0 不变)
interface SubmissionConfig {
  target_url: string;
  method: 'POST' | 'PUT';
  batch_size: number;
}

// 最终导出的 Job Bundle
interface JobBundle {
  meta: { version: string; generated_at: string };
  config: {
    // static_rules 仅用于前端回显，Python 脚本其实只需要 enrichment 和 submission
    // 但为了以后能在前端重新导入编辑，建议保留完整配置
    static_rules: StaticRule[]; 
    enrichment_rules: ApiEnrichmentRule[];
    submission: SubmissionConfig;
  };
  // 注意: source_data 是前端已经应用了 "StaticRule" (包括字典映射) 后的干净数据
  source_data: Record<string, any>[]; 
}

```

#### 4. 处理流程 (Processing Pipeline)

前端在生成 `source_data` 时，必须严格按照以下顺序处理每一单元格：

1. **Extract:** 读取 Excel 单元格原始值。
2. **Map (字典映射):**
* 如果启用了 `use_dictionary`：查找映射表。
* 找到 -> 替换为 Target Value。
* 没找到 -> 应用 `mapping_fallback` 策略。


3. **Cast (类型转换):**
* 将上一步的结果转换为 `data_type` 指定的类型 (e.g., String -> Boolean, String -> Number)。
* *注意:* 如果字典映射的目标值已经是正确的类型（如 `true`），则跳过此步或确保不会再次转为字符串 "true"。


4. **Format:** (如果是日期或数组) 应用格式化规则。

#### 5. 开发任务清单

1. **组件开发:**
* 修改 `ColumnConfigPanel.svelte` (或类似组件)。
* 新增 `DictionaryMapper` 子组件：包含“自动扫描”按钮和“键值对”编辑表格。


2. **逻辑核心:**
* 更新 `processRow` 函数，在类型转换前插入字典查找逻辑。
* 实现 `scanUniqueValues(columnData)` 函数，用于快速提取 Excel 列的去重值。


3. **预览同步:** 确保右侧 JSON 预览能实时响应字典配置的变更。
4. **导出验证:** 导出 `job_bundle.json`，检查 `source_data` 中的值是否已成功转换为映射后的值（例如 "Y" 而不是 "是"）。

---

### 给 AI 的提示 (Prompt Tip)

* **性能注意:** 自动扫描 `scanUniqueValues` 时，如果 Excel 数据量极大（>10万行），不要全量扫描。只扫描前 1000 行即可，并提示用户“仅扫描了前 1000 行，如有遗漏请手动添加”。
* **交互细节:** 字典映射的 Target Value 输入框，应该能智能识别类型。如果用户输入 `true`，应该被识别为 Boolean 而不是字符串 "true"。

---

### 执行步骤

请先基于上述文档，更新 **数据类型定义 (Interfaces)** 和 **核心处理逻辑 (`processRow` 函数)**。