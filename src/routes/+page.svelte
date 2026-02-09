<script lang="ts">
	import type { MappingConfig, RowData, MappingTemplate } from '$lib/types.js';
	import { parseExcelFile } from '$lib/excel.js';
	import { convertData, createDefaultMappings, applyTemplate, exportTemplate } from '$lib/converter.js';
	import ExcelTable from '$lib/components/ExcelTable.svelte';
	import JsonPreview from '$lib/components/JsonPreview.svelte';

	// State
	let headers = $state<string[]>([]);
	let rows = $state<RowData[]>([]);
	let mappings = $state<MappingConfig[]>([]);
	let errorMessage = $state('');
	let fileName = $state('');
	let isDragOver = $state(false);
	let copySuccess = $state(false);

	// Derived
	const hasData = $derived(headers.length > 0 && rows.length > 0);
	const convertedJson = $derived(hasData ? convertData(rows, mappings) : []);
	const jsonString = $derived(JSON.stringify(convertedJson, null, 2));

	// File handling
	async function handleFile(file: File) {
		const validExtensions = ['.xlsx', '.xls', '.csv'];
		const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
		if (!validExtensions.includes(ext)) {
			errorMessage = `不支持的文件格式: ${ext}。请上传 .xlsx, .xls 或 .csv 文件。`;
			return;
		}

		try {
			errorMessage = '';
			const result = await parseExcelFile(file);
			headers = result.headers;
			rows = result.rows;
			mappings = createDefaultMappings(result.headers, result.rows);
			fileName = file.name;
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : '文件解析失败';
			headers = [];
			rows = [];
			mappings = [];
		}
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function onDragLeave() {
		isDragOver = false;
	}

	// Template handling
	function handleExportTemplate() {
		const template = exportTemplate(mappings);
		const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName ? fileName.replace(/\.[^.]+$/, '_mapping.json') : 'mapping_template.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleImportTemplate() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const template: MappingTemplate = JSON.parse(text);
				if (!Array.isArray(template)) {
					errorMessage = '无效的模板格式';
					return;
				}
				mappings = applyTemplate(mappings, template);
				errorMessage = '';
			} catch {
				errorMessage = '模板文件解析失败';
			}
		};
		input.click();
	}

	// JSON operations
	function handleDownloadJson() {
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName ? fileName.replace(/\.[^.]+$/, '.json') : 'output.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleCopyJson() {
		try {
			await navigator.clipboard.writeText(jsonString);
			copySuccess = true;
			setTimeout(() => (copySuccess = false), 2000);
		} catch {
			errorMessage = '复制失败，请手动复制';
		}
	}
</script>

<div
	class="flex h-screen flex-col bg-gray-100"
	ondrop={onDrop}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	role="application"
>
	<!-- Header Toolbar -->
	<header class="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
		<h1 class="text-lg font-bold text-gray-800">Excel → JSON</h1>

		<div class="mx-2 h-6 w-px bg-gray-200"></div>

		<!-- File upload -->
		<label class="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
			</svg>
			上传文件
			<input type="file" accept=".xlsx,.xls,.csv" onchange={onFileInput} class="hidden" />
		</label>

		{#if fileName}
			<span class="text-sm text-gray-500">{fileName}</span>
		{/if}

		<div class="mx-2 h-6 w-px bg-gray-200"></div>

		<!-- Template operations -->
		<button
			onclick={handleImportTemplate}
			disabled={!hasData}
			class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
			</svg>
			导入配置
		</button>
		<button
			onclick={handleExportTemplate}
			disabled={!hasData}
			class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
			</svg>
			导出配置
		</button>

		<div class="flex-1"></div>

		<!-- JSON operations -->
		<button
			onclick={handleDownloadJson}
			disabled={!hasData}
			class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			下载 JSON
		</button>
		<button
			onclick={handleCopyJson}
			disabled={!hasData}
			class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
		>
			{#if copySuccess}
				<svg class="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				已复制
			{:else}
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
				</svg>
				复制 JSON
			{/if}
		</button>
	</header>

	<!-- Error message -->
	{#if errorMessage}
		<div class="flex items-center gap-2 bg-red-50 px-4 py-2 text-sm text-red-700">
			<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{errorMessage}
			<button onclick={() => (errorMessage = '')} aria-label="关闭错误" class="ml-auto text-red-500 hover:text-red-700 cursor-pointer">
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Main content -->
	{#if hasData}
		<div class="flex flex-1 overflow-hidden">
			<!-- Left: Excel Table -->
			<div class="w-1/2 overflow-hidden border-r border-gray-300">
				<ExcelTable {headers} {rows} bind:mappings />
			</div>
			<!-- Right: JSON Preview -->
			<div class="w-1/2 overflow-hidden">
				<JsonPreview json={convertedJson} />
			</div>
		</div>
	{:else}
		<!-- Empty state / drop zone -->
		<div class="flex flex-1 items-center justify-center p-8">
			<div
				class="flex max-w-md flex-col items-center rounded-2xl border-2 border-dashed p-12 text-center transition-colors {isDragOver
					? 'border-blue-500 bg-blue-50'
					: 'border-gray-300 bg-white'}"
			>
				<svg class="mb-4 h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<h2 class="mb-2 text-xl font-semibold text-gray-700">拖拽 Excel 文件到此处</h2>
				<p class="mb-4 text-sm text-gray-500">支持 .xlsx, .xls, .csv 格式</p>
				<label class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
					选择文件
					<input type="file" accept=".xlsx,.xls,.csv" onchange={onFileInput} class="hidden" />
				</label>
			</div>
		</div>
	{/if}
</div>
