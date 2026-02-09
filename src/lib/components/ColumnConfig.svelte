<script lang="ts">
	import type { MappingConfig, DataType, DateFormat } from '$lib/types.js';

	let { config = $bindable(), onclose }: { config: MappingConfig; onclose: () => void } = $props();

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

<div bind:this={panelEl} class="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
	<div class="mb-3 flex items-center justify-between">
		<h4 class="text-sm font-semibold text-gray-700">列配置</h4>
		<button onclick={onclose} aria-label="关闭配置" class="text-gray-400 hover:text-gray-600 cursor-pointer">
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="space-y-3">
		<!-- Source header (read-only) -->
		<div>
			<label for="source-{config.source}" class="mb-1 block text-xs font-medium text-gray-500">源字段</label>
			<input id="source-{config.source}" type="text" value={config.source} disabled
				class="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-500" />
		</div>

		<!-- Target key -->
		<div>
			<label for="target-{config.source}" class="mb-1 block text-xs font-medium text-gray-500">目标字段 (JSON Key)</label>
			<input id="target-{config.source}" type="text" bind:value={config.target}
				class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
		</div>

		<!-- Data type -->
		<div>
			<label for="type-{config.source}" class="mb-1 block text-xs font-medium text-gray-500">数据类型</label>
			<select id="type-{config.source}" value={config.type} onchange={onTypeChange}
				class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
				{#each dataTypes as dt (dt.value)}
					<option value={dt.value}>{dt.label}</option>
				{/each}
			</select>
		</div>

		<!-- Date format (only for date type) -->
		{#if config.type === 'date'}
			<div>
				<label for="format-{config.source}" class="mb-1 block text-xs font-medium text-gray-500">日期格式</label>
				<select id="format-{config.source}" bind:value={config.format}
					class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
					{#each dateFormats as df (df.value)}
						<option value={df.value}>{df.label}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- Exclude if empty -->
		<div class="flex items-center gap-2">
			<input type="checkbox" id="exclude-empty-{config.source}" bind:checked={config.excludeIfEmpty}
				class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
			<label for="exclude-empty-{config.source}" class="text-sm text-gray-600">空值时移除该字段</label>
		</div>

		<!-- Default value -->
		{#if !config.excludeIfEmpty}
			<div>
				<label for="default-{config.source}" class="mb-1 block text-xs font-medium text-gray-500">默认值 (空值时)</label>
				<input id="default-{config.source}" type="text" bind:value={config.defaultValue}
					class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					placeholder="留空则为 null" />
			</div>
		{/if}

		<!-- Enable/disable column -->
		<div class="flex items-center gap-2 border-t border-gray-100 pt-3">
			<input type="checkbox" id="enabled-{config.source}" bind:checked={config.enabled}
				class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
			<label for="enabled-{config.source}" class="text-sm text-gray-600">包含此列到输出</label>
		</div>
	</div>
</div>
