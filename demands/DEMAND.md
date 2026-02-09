项目需求文档 (PRD): Excel 转 JSON 可视化映射工具
1. 项目概述

我们需要开发一个基于 Svelte 的单页应用。该应用允许用户上传 Excel 文件，在左侧预览数据，在右侧实时预览转换后的 JSON 数据。核心功能是用户可以自定义“Excel列”到“JSON字段”的映射规则、处理空值逻辑以及格式化特定数据类型（如日期），并支持将这些配置导出为模板，以便下次复用。
2. 技术栈要求

    框架: Svelte (推荐使用 Svelte 5 或 SvelteKit) + TypeScript

    样式: TailwindCSS (用于快速构建左右分栏布局)

    Excel 处理: xlsx (SheetJS) 或类似的轻量级库

    图标库: Lucide-svelte (可选)

3. 界面布局 (UI Layout)

页面主要分为 顶部工具栏 和 主体内容区。

    顶部工具栏 (Header):

        文件上传按钮 (支持拖拽上传 Excel)。

        模板操作区：[导入配置模板]、[导出当前配置]。

        全局操作：[下载 JSON]、[复制 JSON]。

    主体内容区 (Main Split View):

        左侧 (Source Panel - 50%): 显示 Excel 解析后的表格数据。

            关键交互: 表头应包含“设置”功能。用户点击表头或表头旁边的图标，可以弹出/展开该列的映射配置面板。

        右侧 (Target Panel - 50%): 显示转换后的 JSON 代码预览（支持语法高亮）。

4. 核心功能细节
4.1 Excel 导入与展示

    支持 .xlsx, .xls, .csv 格式。

    读取 Excel 的第一行作为默认表头（Key）。

    数据以表格形式展示在左侧。

4.2 字段映射配置 (Mapping Logic)

这是本应用的核心。每一列都需要一个配置对象，包含以下属性：

    Original Header (源字段): Excel 原始表头名称 (只读)。

    Target Key (目标字段): 映射到 JSON 中的 Key 名称 (用户可修改)。

        示例: Excel 中是 "姓名"，用户输入 "userName"，生成的 JSON 为 {"userName": "..."}。

    Data Type (数据类型):

        String (默认)

        Number

        Boolean

        Date

    Format Rules (格式化规则 - 仅针对特定类型):

        如果是 Date 类型，提供格式化选项 (如 YYYY-MM-DD, YYYY/MM/DD HH:mm, Unix Timestamp)。需要引入 dayjs 或类似库处理。

    Null Handling (空值处理):

        开关选项：Exclude if Empty (如果该单元格为空，则在生成的 JSON 对象中完全移除该 Key)。

        默认值：如果未勾选“移除”，可设置一个默认值 (Default Value)。

4.3 JSON 实时预览

    当用户修改映射配置（如修改 Key 名称、切换日期格式、改变空值策略）时，右侧的 JSON 预览应 实时 (Reactive) 更新。

4.4 模板系统 (Configuration Persistence)

    导出模板: 将当前的映射规则数组导出为 .json 文件。

        数据结构示例:
        JSON

        [
          { "source": "A", "target": "AAA", "type": "string", "excludeIfEmpty": false },
          { "source": "入职日期", "target": "joinDate", "type": "date", "format": "YYYY-MM-DD" }
        ]

    导入模板: 上传上述格式的 JSON 文件，应用自动匹配当前 Excel 的表头。如果 Excel 包含模板中定义的 source 字段，则自动应用对应的规则。

5. 交互流程 (User Story)

    用户打开页面，拖入 staff_data.xlsx。

    左侧显示表格。用户发现“出生日期”这一列解析出来是数字（Excel 时间戳）。

    用户点击“出生日期”列的设置，将类型改为 Date，格式选择 YYYY-MM-DD。

    用户发现有一列“备注”很多是空的，点击设置，勾选 Exclude if Empty。

    用户将“姓名”列的 Target Key 改为 full_name。

    右侧 JSON 实时变成了期望的格式。

    用户点击“导出配置”，保存为 staff_mapping.json。

    下周，用户上传新的 Excel，并点击“导入配置”选择 staff_mapping.json，所有规则自动应用，直接复制右侧 JSON。

请执行以下任务：

    数据结构设计: 定义 MappingConfig 和 RowData 的 TypeScript 接口。

    核心逻辑实现: 编写一个 convertData 函数，根据映射配置将 Excel 原始数据转换为最终 JSON。

    组件编写:

        App.svelte: 主布局和状态管理。

        ExcelTable.svelte: 左侧表格，包含列头配置 UI。

        JsonPreview.svelte: 右侧展示。

    请确保代码不仅能运行，而且具有良好的错误处理（例如文件解析失败）。

支持嵌套对象: 如果 Target Key 包含点号（例如 user.address.city），生成的 JSON 应当自动构建对应的嵌套对象结构，而不是生成一个带点的字符串键名。