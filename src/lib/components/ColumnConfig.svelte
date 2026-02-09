<script lang="ts">
	import type { MappingConfig, DataType, DateFormat, RowData } from '$lib/types.js';
	import DictionaryMapper from './DictionaryMapper.svelte';

	let {
		config = $bindable(),
		rows,
		onclose
	}: {
		config: MappingConfig;
		rows?: RowData[];
		onclose: () => void;
	} = $props();

	const dataTypes: { value: DataType; label: string }[] = [
		{ value: 'string', label: '字符串 (String)' },
		{ value: 'number', label: '数字 (Number)' },
		{ value: 'boolean', label: '布尔 (Boolean)' },
		{ value: 'date', label: '日期 (Date)' }
	];

	const dateFormats: { value: DateFormat; label: string }[] = [
		{ value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
		{ value: 'YYYY/MM/DD', label: 'YYYY/MM/DD' },
		{ value: 'YYYY-MM-DD HH:mm', label: 'YYYY-MM-DD HH:mm' },
		{ value: 'YYYY/MM/DD HH:mm', label: 'YYYY/MM/DD HH:mm' },
		{ value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss' },
		{ value: 'timestamp', label: 'Unix Timestamp' }
	];

	// Initialize dictionary mapping config if not present
	$effect(() => {
		if (config.useDictionary === undefined) {
			config.useDictionary = false;
		}
		if (!config.valueMapping) {
			config.valueMapping = [];
		}
		if (!config.mappingFallback) {
			config.mappingFallback = 'keep';
		}
	});

	function onTypeChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		config.type = select.value as DataType;
		if (config.type === 'date' && !config.format) {
			config.format = 'YYYY-MM-DD';
		}
		if (config.type !== 'date') {
			config.format = undefined;
		}
	}

	// Click outside to close
	let panelEl: HTMLDivElement;

	function onDocumentClick(e: MouseEvent) {
		if (panelEl && !panelEl.contains(e.target as Node)) {
			onclose();
		}
	}

	$effect(() => {
		// Delay listener attachment to avoid catching the opening click itself
		const timer = setTimeout(() => {
			document.addEventListener('click', onDocumentClick, true);
		}, 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', onDocumentClick, true);
		};
	});
</script>

<div
	bind:this={panelEl}
	class="absolute top-full left-0 z-50 mt-1 w-80 max-h-[80vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
>
	<div class="mb-3 flex items-center justify-between">
		<h4 class="text-sm font-semibold text-slate-700 dark:text-slate-200">列配置</h4>
		<button
			onclick={onclose}
			aria-label="关闭配置"
			class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="space-y-3">
		<!-- Source header (read-only) -->
		<div>
			<label for="source-{config.source}" class="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
				>源字段</label
			>
			<input
				id="source-{config.source}"
				type="text"
				value={config.source}
				disabled
				class="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
			/>
		</div>

		<!-- Target key -->
		<div>
			<label for="target-{config.source}" class="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
				>目标字段 (JSON Key)</label
			>
			<input
				id="target-{config.source}"
				type="text"
				bind:value={config.target}
				class="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
			/>
		</div>

		<!-- Data type -->
		<div>
			<label for="type-{config.source}" class="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
				>数据类型</label
			>
			<select
				id="type-{config.source}"
				value={config.type}
				onchange={onTypeChange}
				class="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
			>
				{#each dataTypes as dt (dt.value)}
					<option value={dt.value}>{dt.label}</option>
				{/each}
			</select>
		</div>

		<!-- Date format (only for date type) -->
		{#if config.type === 'date'}
			<div>
				<label for="format-{config.source}" class="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
					>日期格式</label
				>
				<select
					id="format-{config.source}"
					bind:value={config.format}
					class="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
				>
					{#each dateFormats as df (df.value)}
						<option value={df.value}>{df.label}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- Dictionary Mapping -->
		{#if rows}
			<DictionaryMapper
				config={{
					get useDictionary() {
						return config.useDictionary ?? false;
					},
					set useDictionary(v) {
						config.useDictionary = v;
					},
					get valueMapping() {
						return config.valueMapping ?? [];
					},
					set valueMapping(v) {
						config.valueMapping = v;
					},
					get mappingFallback() {
						return config.mappingFallback ?? 'keep';
					},
					set mappingFallback(v) {
						config.mappingFallback = v;
					},
					get mappingCustomValue() {
						return config.mappingCustomValue;
					},
					set mappingCustomValue(v) {
						config.mappingCustomValue = v;
					}
				}}
				{rows}
				sourceColumn={config.source}
			/>
		{/if}

		<!-- Exclude if empty -->
		<div class="flex items-center gap-2">
			<input
				type="checkbox"
				id="exclude-empty-{config.source}"
				bind:checked={config.excludeIfEmpty}
				class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:text-indigo-500 dark:focus:ring-indigo-400"
			/>
			<label for="exclude-empty-{config.source}" class="text-sm text-slate-600 dark:text-slate-400"
				>空值时移除该字段</label
			>
		</div>

		<!-- Default value -->
		{#if !config.excludeIfEmpty}
			<div>
				<label for="default-{config.source}" class="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
					>默认值 (空值时)</label
				>
				<input
					id="default-{config.source}"
					type="text"
					bind:value={config.defaultValue}
					class="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
					placeholder="留空则为 null"
				/>
			</div>
		{/if}

		<!-- Enable/disable column -->
		<div class="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
			<input
				type="checkbox"
				id="enabled-{config.source}"
				bind:checked={config.enabled}
				class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:text-indigo-500 dark:focus:ring-indigo-400"
			/>
			<label for="enabled-{config.source}" class="text-sm text-slate-600 dark:text-slate-400">包含此列到输出</label>
		</div>
	</div>
</div>
