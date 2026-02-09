<script lang="ts">
	let { json }: { json: Record<string, unknown>[] } = $props();

	let collapsed = $state(false);

	const jsonString = $derived(JSON.stringify(json, null, 2));

	/**
	 * Simple JSON syntax highlighting — light theme.
	 */
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
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
		<h3 class="text-sm font-semibold text-gray-700">
			JSON 预览
			<span class="ml-2 text-xs font-normal text-gray-400">{json.length} 条记录</span>
		</h3>
		<div class="flex items-center gap-2">
			<button
				onclick={() => (collapsed = !collapsed)}
				class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 cursor-pointer"
			>
				{collapsed ? '展开' : '折叠'}
			</button>
		</div>
	</div>

	<div class="json-preview flex-1 overflow-auto p-4">
		{#if collapsed}
			<pre class="font-mono text-xs leading-relaxed text-gray-600">{JSON.stringify(json)}</pre>
		{:else}
			<pre class="font-mono text-xs leading-relaxed text-gray-500">{@html highlight(jsonString)}</pre>
		{/if}
	</div>
</div>

<style>
	.json-preview {
		background: #fafbfc;
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
