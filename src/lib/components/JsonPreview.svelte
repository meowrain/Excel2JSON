<script lang="ts">
	import JsonTreeNode from './JsonTreeNode.svelte';
	import { proxyFetch, renderTemplate, extractByPath } from '$lib/utils/proxy.js';
	import type { ApiEnrichmentRule } from '$lib/types.js';

	let { json, enrichmentRules = [], sourceData = [], onupdate }: {
		json: Record<string, unknown>[];
		enrichmentRules?: ApiEnrichmentRule[];
		sourceData?: Record<string, unknown>[];
		onupdate?: (edited: string) => void;
	} = $props();

	const MAX_PREVIEW_CHARS = 2000;
	const MAX_PREVIEW_LINES = 50;
	const MAX_TREE_ITEMS = 50;
	const ENRICH_PREVIEW_LIMIT = 5;

	type ViewMode = 'tree' | 'raw' | 'edit';
	let viewMode = $state<ViewMode>('tree');
	let editText = $state('');
	let parseError = $state('');

	// Enrichment preview state
	let enrichPreviewEnabled = $state(false);
	let isEnriching = $state(false);
	let enrichedJson = $state<Record<string, unknown>[]>([]);
	let enrichErrors = $state<Set<number>>(new Set());

	// Use enriched data when preview is enabled
	const displayJson = $derived(enrichPreviewEnabled ? enrichedJson : json);

	const jsonString = $derived(JSON.stringify(displayJson, null, 2));

	// Truncation for raw preview
	const truncated = $derived.by(() => {
		const lines = jsonString.split('\n');
		if (jsonString.length <= MAX_PREVIEW_CHARS && lines.length <= MAX_PREVIEW_LINES) {
			return { text: jsonString, isTruncated: false, totalChars: jsonString.length, totalLines: lines.length };
		}
		let preview = lines.slice(0, MAX_PREVIEW_LINES).join('\n');
		if (preview.length > MAX_PREVIEW_CHARS) {
			preview = preview.slice(0, MAX_PREVIEW_CHARS);
		}
		return { text: preview, isTruncated: true, totalChars: jsonString.length, totalLines: lines.length };
	});

	// Tree view shows limited items for performance
	const treeData = $derived(displayJson.length > MAX_TREE_ITEMS ? displayJson.slice(0, MAX_TREE_ITEMS) : displayJson);
	const treeTruncated = $derived(displayJson.length > MAX_TREE_ITEMS);

	// Check if enrichment preview is available
	const canEnrich = $derived(enrichmentRules.length > 0 && sourceData.length > 0);

	// Sync from upstream when not editing
	$effect(() => {
		if (viewMode !== 'edit') {
			editText = jsonString;
		}
	});

	// Reset enriched data when base json changes
	$effect(() => {
		if (!enrichPreviewEnabled) {
			enrichedJson = [];
			enrichErrors = new Set();
		}
	});

	async function fetchEnrichmentForRow(rowData: Record<string, unknown>, rules: ApiEnrichmentRule[]): Promise<Record<string, unknown>> {
		const enriched: Record<string, unknown> = { ...rowData };

		for (const rule of rules) {
			try {
				// Render URL template
				const renderedUrl = renderTemplate(rule.url_template, rowData);
				if (!renderedUrl) {
					enriched[rule.target_key] = rule.fallback_value ?? null;
					continue;
				}

				// Prepare headers with template variable replacement
				const headers: Record<string, string> = {};
				if (rule.headers) {
					for (const [key, value] of Object.entries(rule.headers)) {
						headers[key] = renderTemplate(value, rowData);
					}
				}

				// Prepare body for POST
				let body: unknown = undefined;
				if (rule.method === 'POST' && rule.body_template) {
					const renderedBody = renderTemplate(rule.body_template, rowData);
					try {
						body = JSON.parse(renderedBody);
					} catch {
						body = renderedBody;
					}
				}

				// Make proxy request
				const response = await proxyFetch({
					url: renderedUrl,
					method: rule.method,
					headers,
					body
				});

				// Extract value using response path
				const extractedValue = extractByPath(response.data, rule.response_path);
				enriched[rule.target_key] = extractedValue ?? rule.fallback_value ?? null;
			} catch {
				enriched[rule.target_key] = rule.fallback_value ?? null;
			}
		}

		return enriched;
	}

	async function runEnrichmentPreview() {
		if (!canEnrich || isEnriching) return;

		isEnriching = true;
		enrichErrors = new Set();

		const limit = Math.min(ENRICH_PREVIEW_LIMIT, sourceData.length);
		const results: Record<string, unknown>[] = [];

		// Process with concurrency limit of 3
		const CONCURRENCY = 3;
		for (let i = 0; i < limit; i += CONCURRENCY) {
			const batch = sourceData.slice(i, i + CONCURRENCY);
			const promises = batch.map(async (rowData, idx) => {
				try {
					return await fetchEnrichmentForRow(rowData, enrichmentRules);
				} catch {
					enrichErrors.add(i + idx);
					return { ...rowData };
				}
			});

			const batchResults = await Promise.all(promises);
			results.push(...batchResults);
		}

		enrichedJson = results;
		isEnriching = false;
	}

	function toggleEnrichPreview() {
		if (enrichPreviewEnabled) {
			enrichPreviewEnabled = false;
			enrichedJson = [];
			enrichErrors = new Set();
		} else {
			enrichPreviewEnabled = true;
			runEnrichmentPreview();
		}
	}

	function highlight(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"([^"]*)"(?=\s*:)/g, '<span class="json-key">"$1"</span>')
			.replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>')
			.replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
			.replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
			.replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
	}

	function startEdit() {
		editText = jsonString;
		viewMode = 'edit';
		parseError = '';
	}

	function cancelEdit() {
		viewMode = 'tree';
		parseError = '';
		editText = jsonString;
	}

	function applyEdit() {
		try {
			JSON.parse(editText);
			parseError = '';
			viewMode = 'tree';
			onupdate?.(editText);
		} catch {
			parseError = 'JSON 格式错误，请检查语法';
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Header -->
	<div class="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
		<div class="flex items-center gap-3">
			<h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
				JSON
				<span class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">{displayJson.length} 条</span>
			</h3>

			<!-- Enrichment Preview Toggle -->
			{#if canEnrich}
				<button
					onclick={toggleEnrichPreview}
					disabled={isEnriching}
					class="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {enrichPreviewEnabled
						? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
						: 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}"
					title="仅预览前 {ENRICH_PREVIEW_LIMIT} 条数据的 API 增强结果"
				>
					{#if isEnriching}
						<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						加载中...
					{:else}
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
						<span>实时预览</span>
					{/if}
				</button>
			{/if}
		</div>

		<div class="flex items-center gap-1">
			{#if viewMode === 'edit'}
				<button onclick={applyEdit} class="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 cursor-pointer">
					应用
				</button>
				<button onclick={cancelEdit} class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer">
					取消
				</button>
			{:else}
				<!-- View mode tabs -->
				<div class="flex rounded border border-slate-300 text-xs dark:border-slate-700">
					<button
						onclick={() => (viewMode = 'tree')}
						class="px-2 py-1 cursor-pointer {viewMode === 'tree' ? 'bg-slate-200 text-slate-800 font-medium dark:bg-slate-700 dark:text-slate-200' : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'}"
						style="border-radius: 3px 0 0 3px"
					>
						树形
					</button>
					<button
						onclick={() => (viewMode = 'raw')}
						class="border-l border-slate-300 px-2 py-1 cursor-pointer {viewMode === 'raw' ? 'bg-slate-200 text-slate-800 font-medium dark:bg-slate-700 dark:text-slate-200' : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'}"
						style="border-radius: 0 3px 3px 0"
					>
						源码
					</button>
				</div>
				<button onclick={startEdit} class="ml-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 cursor-pointer dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
					编辑
				</button>
			{/if}
		</div>
	</div>

	{#if parseError}
		<div class="shrink-0 bg-red-50 px-4 py-1.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">{parseError}</div>
	{/if}

	<!-- Enrichment warning -->
	{#if enrichPreviewEnabled}
		<div class="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
			<span class="font-medium">实时预览模式</span> — 仅展示前 {ENRICH_PREVIEW_LIMIT} 条数据的 API 增强结果，用于测试配置。导出时将处理全部数据。
		</div>
	{/if}

	<!-- Content -->
	<div class="json-preview flex-1 overflow-hidden">
		{#if viewMode === 'edit'}
			<textarea
				bind:value={editText}
				oninput={() => { parseError = ''; }}
				spellcheck="false"
				class="json-textarea h-full w-full resize-none overflow-auto border-0 bg-transparent font-mono text-xs leading-relaxed text-slate-700 outline-none dark:text-slate-300"
			></textarea>
		{:else if viewMode === 'tree'}
			<div class="h-full overflow-auto px-4 py-3">
				<JsonTreeNode value={treeData} defaultOpen={true} />
				{#if treeTruncated}
					<div class="mt-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
						&#x26A0;&#xFE0F; 树形视图仅展示前 {MAX_TREE_ITEMS} 条记录（共 {displayJson.length.toLocaleString()} 条）。请下载或复制查看完整数据。
					</div>
				{/if}
			</div>
		{:else}
			<div class="h-full overflow-auto">
				<pre class="json-content whitespace-pre font-mono text-xs leading-relaxed text-slate-500 dark:text-slate-400">{@html highlight(truncated.text)}</pre>
				{#if truncated.isTruncated}
					<div class="sticky bottom-0 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
						&#x26A0;&#xFE0F; 预览已截断（显示 {Math.min(MAX_PREVIEW_CHARS, truncated.text.length).toLocaleString()}/{truncated.totalChars.toLocaleString()} 字符，{Math.min(MAX_PREVIEW_LINES, truncated.totalLines)}/{truncated.totalLines.toLocaleString()} 行）。请下载或复制查看完整数据。
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.json-preview {
		background: #fafbfc;
		content-visibility: auto;
	}
	:global(.dark) .json-preview {
		background: #0d1117;
	}
	.json-content {
		padding: 16px;
		margin: 0;
		content-visibility: auto;
	}
	.json-textarea {
		padding: 16px;
		tab-size: 2;
	}
</style>
