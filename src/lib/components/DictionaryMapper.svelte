<script lang="ts">
	import type { ValueMapItem, MappingFallback, RowData } from '$lib/types.js';
	import { scanUniqueValues } from '$lib/converter.js';

	let {
		config = $bindable(),
		rows,
		sourceColumn
	}: {
		config: {
			useDictionary: boolean;
			valueMapping: ValueMapItem[];
			mappingFallback: MappingFallback;
			mappingCustomValue?: string;
		};
		rows: RowData[];
		sourceColumn: string;
	} = $props();

	const fallbackOptions: { value: MappingFallback; label: string }[] = [
		{ value: 'keep', label: '保留原值' },
		{ value: 'null', label: '设为 null' },
		{ value: 'custom', label: '自定义值' }
	];

	let newSourceValue = $state('');
	let newTargetValue = $state('');

	function enableDictionary() {
		config.useDictionary = true;
		if (config.valueMapping.length === 0) {
			scanColumnValues();
		}
	}

	function disableDictionary() {
		config.useDictionary = false;
	}

	function scanColumnValues() {
		const uniqueValues = scanUniqueValues(sourceColumn, rows);
		config.valueMapping = uniqueValues.map((v) => ({
			source: v,
			target: v
		}));
	}

	function addMappingItem() {
		if (!newSourceValue) return;
		config.valueMapping = [
			...config.valueMapping,
			{ source: newSourceValue, target: newTargetValue || newSourceValue }
		];
		newSourceValue = '';
		newTargetValue = '';
	}

	function removeMappingItem(index: number) {
		config.valueMapping = config.valueMapping.filter((_, i) => i !== index);
	}

	function updateTargetValue(index: number, value: string) {
		// Create a new array to trigger Svelte 5 reactivity
		config.valueMapping = config.valueMapping.map((item, i) =>
			i === index
				? { ...item, target: parseTargetValue(value) }
				: item
		);
	}

	function parseTargetValue(value: string): unknown {
		if (value === 'null' || value === '') return null;
		if (value === 'true') return true;
		if (value === 'false') return false;
		if (value === 'undefined') return undefined;

		const num = Number(value);
		if (!isNaN(num) && value !== '') return num;

		if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		}

		return value;
	}

	function formatTargetValue(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (typeof value === 'string') return value;
		return JSON.stringify(value);
	}
</script>

<div class="space-y-2">
	<!-- Toggle -->
	<div class="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
		<span class="text-xs font-semibold text-slate-700 dark:text-slate-300">字典映射</span>
		{#if !config.useDictionary}
			<button
				onclick={enableDictionary}
				class="rounded bg-indigo-600 px-2 py-0.5 text-xs text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
			>
				启用
			</button>
		{:else}
			<button
				onclick={disableDictionary}
				class="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
			>
				禁用
			</button>
		{/if}
	</div>

	{#if config.useDictionary}
		<!-- Auto Scan Button -->
		<button
			onclick={scanColumnValues}
			class="w-full rounded border border-indigo-600 bg-indigo-50 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
		>
			🔄 自动扫描列值
		</button>

		<!-- Mapping Table -->
		{#if config.valueMapping.length > 0}
			<div class="max-h-32 overflow-y-auto rounded border border-slate-200 dark:border-slate-700">
				<table class="w-full text-xs">
					<thead class="bg-slate-50 sticky top-0 dark:bg-slate-900">
						<tr>
							<th class="px-1.5 py-1 text-left font-medium text-slate-600 text-[10px] dark:text-slate-400">源</th>
							<th class="px-1.5 py-1 text-left font-medium text-slate-600 text-[10px] dark:text-slate-400">目标</th>
							<th class="w-6"></th>
						</tr>
					</thead>
					<tbody>
						{#each config.valueMapping as item, index (index)}
							<tr class="border-t border-slate-100 dark:border-slate-800">
								<td class="px-1.5 py-1 text-slate-700 truncate max-w-24 dark:text-slate-300" title={String(item.source)}>{String(item.source)}</td>
								<td class="px-1.5 py-1">
									<input
										type="text"
										value={formatTargetValue(item.target)}
										oninput={(e) => updateTargetValue(index, e.currentTarget.value)}
										class="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
									/>
								</td>
								<td class="px-0.5 py-1">
									<button
										onclick={() => removeMappingItem(index)}
										class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-0.5"
										title="删除"
									>
										<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-[10px] text-slate-400 text-center dark:text-slate-500">暂无映射项</p>
		{/if}

		<!-- Manual Add (compact) -->
		<div class="flex gap-1">
			<input
				bind:value={newSourceValue}
				type="text"
				placeholder="源值"
				class="w-20 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
			/>
			<input
				bind:value={newTargetValue}
				type="text"
				placeholder="目标"
				class="flex-1 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
			/>
			<button
				onclick={addMappingItem}
				disabled={!newSourceValue}
				class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
			>
				+
			</button>
		</div>

		<!-- Fallback Strategy (compact) -->
		<div class="flex items-center gap-2">
			<span class="text-[10px] text-slate-500 whitespace-nowrap dark:text-slate-400">未匹配:</span>
			<select
				bind:value={config.mappingFallback}
				class="flex-1 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
			>
				{#each fallbackOptions as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<!-- Custom Fallback Value (compact) -->
		{#if config.mappingFallback === 'custom'}
			<input
				bind:value={config.mappingCustomValue}
				type="text"
				placeholder="自定义默认值 (如: null, true, 0)"
				class="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
			/>
		{/if}
	{/if}
</div>
