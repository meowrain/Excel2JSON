
**Role:** 资深 UI/UX 工程师 & Svelte 专家

**Current Context:**
我们已经完成了 "Excel2JSON ETL Blueprint Generator" 的核心功能（Excel 解析、API 配置、JSON 导出）。
目前的界面比较原始。现在需要进行 **Phase 3: UI/UX Overhaul & Theming**。

**Goal:**
全面优化应用样式，引入 **Dark Mode (夜间模式)** 支持，提升视觉层级和交互体验。目标风格是 **"Modern SaaS"** (类似 Vercel/Linear/Shadcn 的风格)。

### Phase 3: UI/UX 优化与多主题需求文档

#### 1. 技术方案 (Technical Approach)

* **Tailwind CSS Dark Mode:** 使用 `class` 策略（通过在 `<html>` 标签添加 `class="dark"` 来切换）。
* **State Management:** 创建一个 `themeStore.ts` (Svelte Store)，用于管理 `light` | `dark` | `system` 状态，并持久化到 `localStorage`。
* **CSS Variables:** 建议在 `app.css` 中定义语义化的 CSS 变量 (如 `--bg-primary`, `--text-secondary`)，或者直接使用 Tailwind 的 `slate` 色系作为主轴。

#### 2. 设计规范 (Design System Specs)

请严格遵循以下配色逻辑，确保深色模式下的对比度和可读性。

##### 2.1 基础色盘 (Color Palette)

* **Primary Brand:** Indigo-600 (Light) / Indigo-500 (Dark)
* **Background (Canvas):**
* Light: `bg-white` (Main), `bg-slate-50` (Sidebar/Header)
* Dark: `bg-slate-950` (Main), `bg-slate-900` (Sidebar/Header)


* **Surface (Cards/Modals):**
* Light: `bg-white` + `shadow-sm` + `border-slate-200`
* Dark: `bg-slate-900` + `shadow-none` + `border-slate-800`


* **Text (Typography):**
* Primary: `text-slate-900` (Light) / `text-slate-50` (Dark)
* Secondary: `text-slate-500` (Light) / `text-slate-400` (Dark)
* Muted: `text-slate-400` (Light) / `text-slate-500` (Dark)


* **Borders:** `border-slate-200` (Light) / `border-slate-800` (Dark)

##### 2.2 交互反馈 (Interactive States)

* **Buttons:**
* Primary: Solid Indigo background. Hover: `hover:bg-indigo-700` (Light) / `hover:bg-indigo-400` (Dark).
* Ghost/Secondary: Transparent background. Hover: `hover:bg-slate-100` (Light) / `hover:bg-slate-800` (Dark).


* **Inputs:**
* Default: `bg-transparent border border-slate-300 dark:border-slate-700`.
* Focus: `ring-2 ring-indigo-500/20 border-indigo-500`.



#### 3. 组件级优化详情

##### 3.1 顶部导航栏 (Header)

* **布局:** Flexbox，高度 `h-14` or `h-16`。
* **功能区:**
* 左侧: Logo + Title (Bold, Tracking-tight)。
* 右侧: [Export Button] [Settings Icon] [Theme Toggle]。


* **Theme Toggle:** 实现一个图标按钮，点击在 🌞 (Sun) / 🌙 (Moon) / 💻 (System) 之间切换。切换时添加平滑的 `transition-colors` 动画。

##### 3.2 Excel 表格区域 (Left Panel)

* **容器:** 卡片式设计，圆角 `rounded-lg`，带边框。
* **表头 (Thead):**
* Light: `bg-slate-50`
* Dark: `bg-slate-900`
* 文字: `text-xs font-semibold uppercase tracking-wider text-slate-500`.


* **单元格 (Td):**
* 必须有边框：`border-r border-b border-slate-200 dark:border-slate-800`。
* 斑马纹 (Zebra Striping): 偶数行在 Dark mode 下给予微弱的背景色 `dark:even:bg-slate-900/50` 增加可读性。


* **列配置按钮:** 表头上的“设置图标”在 Hover 时才显示，保持界面整洁。

##### 3.3 JSON 预览区域 (Right Panel)

* **容器:** 模拟 IDE/终端外观。
* **背景:**
* Light: `bg-slate-50` (或者纯白)
* Dark: `bg-[#0d1117]` (GitHub Dark Dimmed 风格) 或 `bg-slate-950`.


* **代码高亮:**
* **关键点:** 语法高亮需要根据主题动态切换。
* 如果没有引入重的 highlighter 库，请手动为 Key/String/Number/Boolean 定义两套颜色。
* *Example:* Keys (Blue-600/Blue-400), Strings (Green-600/Green-400), Numbers (Orange-600/Orange-400).


* **Copy 按钮:** 悬浮在右上角的绝对定位按钮，点击后显示 "Copied!" 提示。

##### 3.4 模态框 (Modals - API & Dictionary Config)

* **背景遮罩 (Backdrop):** `bg-black/50` (Light) / `bg-black/80` (Dark) with `backdrop-blur-sm`.
* **弹窗本体:** `bg-white dark:bg-slate-900`，边框 `dark:border-slate-700`。
* **表单元素:** 输入框在 Dark Mode 下背景应为 `bg-slate-950` 或深灰色，避免过亮。

##### 3.5 滚动条 (Scrollbars)

* 请自定义 Webkit 滚动条样式，使其不再是默认的丑陋灰色条。
* Track: Transparent.
* Thumb: `bg-slate-300 dark:bg-slate-700`，圆角 `rounded-full`。

#### 4. 开发任务清单 (Action Plan)

1. **基础建设:**
* 在 `app.css` 中配置 Tailwind 的 `@apply` 基础样式。
* 实现 `themeStore.ts` 并处理 `onMount` 时的系统偏好检测。
* 在 `App.svelte` 根节点绑定 `class:dark={$themeStore === 'dark'}`。


2. **组件重构:**
* 重写 `Header.svelte`，加入主题切换器。
* 重构 `ExcelTable.svelte` 的 class，全面加入 `dark:` 修饰符。
* 重构 `JsonPreview.svelte`，优化配色和字体 (使用 Monospace 字体)。
* 优化 `Modal` 和 `Drawer` 组件的阴影和边框。


3. **细节打磨:**
* 为所有可点击元素添加 `transition-all duration-200`。
* 确保 Loading 状态（骨架屏或 Spinner）在深色模式下不可见度正常。



---

### 给 AI 的提示 (Prompt Tip)

* **Syntax Highlighting:** 告诉 Claude，如果目前的 JSON 预览只是纯文本 `pre` 标签，请帮我写一个简单的 `syntaxHighlight(json)` 函数，通过正则把 HTML 标签包进去，并用 Tailwind 的颜色类（如 `text-blue-600 dark:text-blue-400`）来控制颜色，从而实现轻量级的双模式高亮。

---

### 你可以期待的效果

有了这份文档，Claude 会帮你把界面做得像 **VS Code** 或 **GitHub** 一样专业。
左边是清爽的表格，右边是极客风的代码预览，切换开关时，整个页面会平滑过渡（如果不做 transition 就是瞬间切换，做了就是渐变，建议做 transition）。