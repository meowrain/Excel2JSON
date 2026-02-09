<script lang="ts">
	import type { MappingConfig, RowData, ApiEnrichmentRule } from '$lib/types.js';
	import ColumnConfig from './ColumnConfig.svelte';

	let {
		headers,
		rows,
		mappings = $bindable(),
		enrichmentRules = [],
		onaddapi,
		oneditapi,
		ondeleteapi
	}: {
		headers: string[];
		rows: RowData[];
		mappings: MappingConfig[];
		enrichmentRules?: ApiEnrichmentRule[];
		onaddapi?: () => void;
		oneditapi?: (index: number) => void;
		ondeleteapi?: (index: number) => void;
	} = $props();

	let activeConfigIndex = $state<number | null>(null);
	const maxPreviewRows = 100;

	function toggleConfig(index: number) {
		activeConfigIndex = activeConfigIndex === index ? null : index;
	}

	function displayValue(value: unknown): string {
		if (value === undefined || value === null || value === '') return '';
		if (value instanceof Date) {
			const y = value.getFullYear();
			const m = String(value.getMonth() + 1).padStart(2, '0');
			const d = String(value.getDate()).padStart(2, '0');
			const H = String(value.getHours()).padStart(2, '0');
			const M = String(value.getMinutes()).padStart(2, '0');
			const S = String(value.getSeconds()).padStart(2, '0');
			if (H === '00' && M === '00' && S === '00') return `${y}-${m}-${d}`;
			return `${y}-${m}-${d} ${H}:${M}:${S}`;
		}
		return String(value);
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-2">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold text-gray-700">
				Excel 数据
				<span class="ml-2 text-xs font-normal text-gray-400">
					{rows.length} 行 × {headers.length} 列
					{#if enrichmentRules.length > 0}
						+ {enrichmentRules.length} API 字段
					{/if}
					{#if rows.length > maxPreviewRows}
						（显示前 {maxPreviewRows} 行）
					{/if}
				</span>
			</h3>
			{#if onaddapi}
				<button
					onclick={onaddapi}
					class="inline-flex cursor-pointer items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					添加 API 字段
				</button>
			{/if}
		</div>
	</div>

	<!-- Enrichment rules bar -->
	{#if enrichmentRules.length > 0}
		<div class="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-purple-50/50 px-4 py-2">
			<span class="text-xs font-medium text-purple-600">API 字段:</span>
			{#each enrichmentRules as rule, i (i)}
				<span class="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
					{rule.target_key}
					<span class="text-purple-400">({rule.method})</span>
					{#if oneditapi}
						<button
							onclick={() => oneditapi?.(i)}
							class="cursor-pointer text-purple-400 hover:text-purple-600"
							title="编辑"
						>
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
						</button>
					{/if}
					{#if ondeleteapi}
						<button
							onclick={() => ondeleteapi?.(i)}
							class="cursor-pointer text-purple-400 hover:text-red-500"
							title="删除"
						>
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</span>
			{/each}
		</div>
	{/if}

	<div class="flex-1 overflow-auto">
		<table class="w-full text-sm">
			<thead class="sticky top-0 z-10 bg-gray-50">
				<tr>
					{#each headers as header, i (header)}
						<th class="relative border-b border-r border-gray-200 px-3 py-2 text-left font-medium text-gray-600">
							<div class="flex items-center gap-1">
								<span class="truncate" title={header}>{header}</span>
								<button
									onclick={() => toggleConfig(i)}
									class="ml-auto flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 cursor-pointer"
									title="配置此列"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
											d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								</button>
								{#if mappings[i] && mappings[i].target !== mappings[i].source}
									<span class="text-xs text-blue-500" title="映射为: {mappings[i].target}">→ {mappings[i].target}</span>
								{/if}
							</div>
							{#if activeConfigIndex === i && mappings[i]}
								<ColumnConfig bind:config={mappings[i]} onclose={() => (activeConfigIndex = null)} />
							{/if}
						</th>
					{/each}
					<!-- API enrichment columns (virtual) -->
					{#each enrichmentRules as rule (rule.target_key)}
						<th class="border-b border-r border-purple-200 bg-purple-50 px-3 py-2 text-left font-medium text-purple-600">
							<div class="flex items-center gap-1">
								<svg class="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
								<span class="truncate" title="{rule.target_key} (API)">{rule.target_key}</span>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows.slice(0, maxPreviewRows) as row, rowIdx (rowIdx)}
					<tr class={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
						{#each headers as header (header)}
							<td class="border-b border-r border-gray-100 px-3 py-1.5 text-gray-700" title={displayValue(row[header])}>
								<span class="block max-w-[200px] truncate">{displayValue(row[header])}</span>
							</td>
						{/each}
						<!-- API placeholder cells -->
						{#each enrichmentRules as _ (_.target_key)}
							<td class="border-b border-r border-purple-100 bg-purple-50/30 px-3 py-1.5 text-xs italic text-purple-400">
								[Pending API Fetch]
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
