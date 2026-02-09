<script lang="ts">
	import type { MappingConfig, RowData } from '$lib/types.js';
	import ColumnConfig from './ColumnConfig.svelte';

	let {
		headers,
		rows,
		mappings = $bindable()
	}: {
		headers: string[];
		rows: RowData[];
		mappings: MappingConfig[];
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
		<h3 class="text-sm font-semibold text-gray-700">
			Excel 数据
			<span class="ml-2 text-xs font-normal text-gray-400">
				{rows.length} 行 × {headers.length} 列
				{#if rows.length > maxPreviewRows}
					（显示前 {maxPreviewRows} 行）
				{/if}
			</span>
		</h3>
	</div>

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
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
