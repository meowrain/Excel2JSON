# excel2json

一个基于 **SvelteKit + TypeScript** 的 Excel 转 JSON 可视化工具。  
支持上传 Excel/CSV、列级映射配置、实时 JSON 预览、模板导入导出与一键复制/下载。

## 功能特性

- 支持文件格式：`.xlsx`、`.xls`、`.csv`
- 左侧表格预览 Excel 数据，右侧实时预览转换后的 JSON
- 每列可配置：
  - 目标字段名（`target`）
  - 数据类型（`string` / `number` / `boolean` / `date`）
  - 日期格式（如 `YYYY-MM-DD`、`YYYY-MM-DD HH:mm:ss`、`timestamp`）
  - 空值策略（空值时移除字段 / 使用默认值）
  - 是否启用该列输出
- 支持嵌套字段：`user.address.city` 会生成嵌套对象，而不是带点字符串键名
- 支持映射模板导入/导出（JSON）
- 支持导出 JSON 文件与复制 JSON 到剪贴板
- 包含单元测试（`vitest`）

## 技术栈

- `Svelte 5` + `SvelteKit 2`
- `TypeScript`
- `Tailwind CSS 4`
- `xlsx`（SheetJS）
- `dayjs`
- `Vitest`

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 启动开发环境

```bash
npm run dev
```

默认地址通常为：`http://localhost:5173`

### 3) 构建与预览

```bash
npm run build
npm run preview
```

## 使用说明

1. 上传或拖拽 Excel/CSV 文件
2. 在左侧点击列头“设置”调整映射规则
3. 右侧实时查看 JSON 结果
4. 可导出当前映射为模板，供后续复用
5. 使用“下载 JSON”或“复制 JSON”输出结果

## 映射模板格式

模板是一个 JSON 数组，每一项对应一列配置。示例：

```json
[
  {
    "source": "姓名",
    "target": "user.name",
    "type": "string",
    "excludeIfEmpty": false,
    "defaultValue": ""
  },
  {
    "source": "入职日期",
    "target": "user.joinDate",
    "type": "date",
    "format": "YYYY-MM-DD",
    "excludeIfEmpty": true
  }
]
```

## 开发脚本

- `npm run dev`：启动开发服务器
- `npm run build`：生产构建
- `npm run preview`：预览构建产物
- `npm run check`：类型与 Svelte 检查
- `npm run test`：运行测试（单次）
- `npm run test:unit`：运行 Vitest（交互模式）

## 项目结构（核心）

- `src/routes/+page.svelte`：主页面与整体交互
- `src/lib/excel.ts`：Excel/CSV 读取与解析
- `src/lib/converter.ts`：映射转换核心逻辑
- `src/lib/types.ts`：类型定义（`MappingConfig`、`RowData` 等）
- `src/lib/components/ExcelTable.svelte`：左侧数据表格
- `src/lib/components/ColumnConfig.svelte`：列映射配置面板
- `src/lib/components/JsonPreview.svelte`：右侧 JSON 预览

## 注意事项

- 日期字段会尽量兼容 Excel 序列日期（数字日期）
- 当 `excludeIfEmpty = true` 时，空值字段不会出现在输出 JSON 中
- 若目标字段包含 `.`，会按路径写入嵌套对象
