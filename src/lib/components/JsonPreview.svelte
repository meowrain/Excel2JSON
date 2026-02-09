<script lang="ts">
	let { json, onupdate }: {
		json: Record<string, unknown>[];
		onupdate?: (edited: string) => void;
	} = $props();

	const MAX_PREVIEW_CHARS = 2000;
	const MAX_PREVIEW_LINES = 50;

	let editing = $state(false);
	let editText = $state('');
	let parseError = $state('');

	const jsonString = $derived(JSON.stringify(json, null, 2));

	// Truncation for preview
	const truncated = $derived.by(() => {
		const lines = jsonString.split('\n');
		if (jsonString.length <= MAX_PREVIEW_CHARS && lines.length <= MAX_PREVIEW_LINES) {
			return { text: jsonString, isTruncated: false, totalChars: jsonString.length, totalLines: lines.length };
		}
		// Truncate by line first, then by char
		let preview = lines.slice(0, MAX_PREVIEW_LINES).join('\n');
		if (preview.length > MAX_PREVIEW_CHARS) {
			preview = preview.slice(0, MAX_PREVIEW_CHARS);
		}
		return { text: preview, isTruncated: true, totalChars: jsonString.length, totalLines: lines.length };
	});

	// Sync from upstream when not editing
	$effect(() => {
		if (!editing) {
			editText = jsonString;
		}
	});

	function highlight(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"([^"]*)"(?=\s*:)/g, '<span class="json-key">"$1"</span>')
			.replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>')
			.replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
			.replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>')
			.replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
	}

	function startEdit() {
		editText = jsonString;
		editing = true;
		parseError = '';
	}

	function cancelEdit() {
		editing = false;
		parseError = '';
		editText = jsonString;
	}

	function applyEdit() {
		try {
			JSON.parse(editText);
			parseError = '';
			editing = false;
			onupdate?.(editText);
		} catch {
			parseError = 'JSON 格式错误，请检查语法';
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
		<h3 class="text-sm font-semibold text-gray-700">
			JSON 预览
			<span class="ml-2 text-xs font-normal text-gray-400">{json.length} 条记录</span>
		</h3>
		<div class="flex items-center gap-1.5">
			{#if editing}
				<button onclick={applyEdit} class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 cursor-pointer">
					应用
				</button>
				<button onclick={cancelEdit} class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 cursor-pointer">
					取消
				</button>
			{:else}
				<button onclick={startEdit} class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 cursor-pointer">
					编辑
				</button>
			{/if}
		</div>
	</div>

	{#if parseError}
		<div class="flex-shrink-0 bg-red-50 px-4 py-1.5 text-xs text-red-600">{parseError}</div>
	{/if}

	<div class="json-preview flex-1 overflow-hidden">
		{#if editing}
			<!-- Plain textarea for editing — no overlay highlighting to avoid lag -->
			<textarea
				bind:value={editText}
				oninput={() => { parseError = ''; }}
				spellcheck="false"
				class="json-textarea h-full w-full resize-none overflow-auto border-0 bg-transparent font-mono text-xs leading-relaxed text-gray-700 outline-none"
			></textarea>
		{:else}
			<div class="h-full overflow-auto">
				<pre class="json-content whitespace-pre font-mono text-xs leading-relaxed text-gray-500">{@html highlight(truncated.text)}</pre>
				{#if truncated.isTruncated}
					<div class="truncation-notice sticky bottom-0 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
						&#x26A0;&#xFE0F; 预览已截断以提升性能（显示 {Math.min(MAX_PREVIEW_CHARS, truncated.text.length).toLocaleString()}/{truncated.totalChars.toLocaleString()} 字符，{Math.min(MAX_PREVIEW_LINES, truncated.totalLines)}/{truncated.totalLines.toLocaleString()} 行）。请点击下载或复制查看完整数据。
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
	.json-content {
		padding: 16px;
		margin: 0;
		content-visibility: auto;
	}
	.json-textarea {
		padding: 16px;
		tab-size: 2;
	}
	:global(.json-key) {
		color: #24292e;
		font-weight: 500;
	}
	:global(.json-string) {
		color: #22863a;
	}
	:global(.json-number) {
		color: #005cc5;
	}
	:global(.json-bool) {
		color: #d73a49;
	}
	:global(.json-null) {
		color: #9ca3af;
		font-style: italic;
	}
</style>
