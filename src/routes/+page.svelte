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

	// Split panel
	let splitPercent = $state(50);
	let jsonCollapsed = $state(false);
	let isDraggingSplit = $state(false);
	let containerEl = $state<HTMLDivElement>();

	function onSplitPointerDown(e: PointerEvent) {
		e.preventDefault();
		isDraggingSplit = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onSplitPointerMove(e: PointerEvent) {
		if (!isDraggingSplit || !containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		const pct = ((e.clientX - rect.left) / rect.width) * 100;
		splitPercent = Math.max(20, Math.min(80, pct));
	}

	function onSplitPointerUp() {
		isDraggingSplit = false;
	}

	function toggleJsonPanel() {
		jsonCollapsed = !jsonCollapsed;
		if (!jsonCollapsed && splitPercent > 80) splitPercent = 50;
	}

	// Derived
	const hasData = $derived(headers.length > 0 && rows.length > 0);

	// Debounced conversion to avoid lag while editing mappings
	let convertedJson = $state<Record<string, unknown>[]>([]);
	let debounceTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		// $state.snapshot forces deep read of all nested properties,
		// so changes to e.g. mappings[i].target will trigger this effect
		const snapshotMappings = $state.snapshot(mappings);
		const currentRows = rows;
		const dataReady = hasData;

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			convertedJson = dataReady ? convertData(currentRows, snapshotMappings) : [];
		}, 150);
	});

	// Manual JSON editing — overrides converted output until next mapping/data change
	let manualJson = $state<string | null>(null);

	const jsonString = $derived(manualJson ?? JSON.stringify(convertedJson, null, 2));

	function onJsonEdited(edited: string) {
		manualJson = edited;
	}

	// Clear manual override when conversion changes
	$effect(() => {
		convertedJson;
		manualJson = null;
	});

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

		<!-- GitHub -->
		<a
			href="https://github.com/meowrain/Excel2JSON"
			target="_blank"
			rel="noopener noreferrer"
			class="ml-1 inline-flex items-center rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
			title="GitHub"
		>
			<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
				<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
			</svg>
		</a>
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
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={containerEl}
			class="relative flex flex-1 overflow-hidden"
			onpointermove={onSplitPointerMove}
			onpointerup={onSplitPointerUp}
		>
			<!-- Left: Excel Table -->
			<div class="overflow-hidden" style="width: {jsonCollapsed ? '100%' : `${splitPercent}%`}">
				<ExcelTable {headers} {rows} bind:mappings />
			</div>

			{#if !jsonCollapsed}
				<!-- Drag handle -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="group flex w-2 flex-shrink-0 cursor-col-resize items-center justify-center bg-gray-200 hover:bg-blue-300 active:bg-blue-400 transition-colors"
					onpointerdown={onSplitPointerDown}
				>
					<div class="h-8 w-0.5 rounded-full bg-gray-400 group-hover:bg-blue-500"></div>
				</div>

				<!-- Right: JSON Preview -->
				<div class="relative flex-1 overflow-hidden">
					<button
						onclick={toggleJsonPanel}
						aria-label="收起 JSON 面板"
						class="absolute top-2 right-2 z-10 rounded bg-white/80 p-1 text-gray-400 shadow hover:bg-white hover:text-gray-600 cursor-pointer"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
						</svg>
					</button>
					<JsonPreview json={convertedJson} onupdate={onJsonEdited} />
				</div>
			{:else}
				<!-- Collapsed JSON mini-panel -->
				<div class="flex w-10 flex-shrink-0 flex-col items-center border-l border-gray-200 bg-gray-50 py-3">
					<button
						onclick={toggleJsonPanel}
						aria-label="展开 JSON 面板"
						class="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 cursor-pointer"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
						</svg>
					</button>
					<span class="mt-2 text-xs text-gray-400" style="writing-mode: vertical-rl">JSON</span>
				</div>
			{/if}
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
