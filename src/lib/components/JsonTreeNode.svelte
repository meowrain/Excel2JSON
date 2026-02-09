<script lang="ts">
	import JsonTreeNode from './JsonTreeNode.svelte';

	let {
		value,
		keyName = undefined,
		depth = 0,
		defaultOpen = false
	}: {
		value: unknown;
		keyName?: string | number;
		depth?: number;
		defaultOpen?: boolean;
	} = $props();

	let open = $state(defaultOpen);

	const valueType = $derived(
		value === null ? 'null'
		: Array.isArray(value) ? 'array'
		: typeof value === 'object' ? 'object'
		: typeof value
	);

	const isExpandable = $derived(valueType === 'object' || valueType === 'array');
	const entries = $derived(
		isExpandable
			? Object.entries(value as Record<string, unknown>)
			: []
	);
	const childCount = $derived(entries.length);

	const preview = $derived(
		valueType === 'array' ? `Array(${childCount})`
		: valueType === 'object' ? `{${childCount}}`
		: ''
	);
</script>

<div class="tree-node" style="padding-left: {depth > 0 ? 16 : 0}px">
	<div class="node-row flex items-baseline gap-1 py-0.5">
		{#if isExpandable}
			<button
				onclick={() => (open = !open)}
				class="toggle flex-shrink-0 cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] leading-none text-gray-400 hover:text-gray-700"
				aria-label={open ? '折叠' : '展开'}
			>
				{open ? '▼' : '▶'}
			</button>
		{:else}
			<span class="w-[10px] flex-shrink-0"></span>
		{/if}

		{#if keyName !== undefined}
			<span class="node-key font-mono text-xs font-medium text-gray-800">
				{typeof keyName === 'number' ? keyName : `"${keyName}"`}</span><span class="text-xs text-gray-400">:&nbsp;</span>
		{/if}

		{#if isExpandable}
			<button
				onclick={() => (open = !open)}
				class="cursor-pointer border-0 bg-transparent p-0 font-mono text-xs text-gray-400 hover:text-gray-600"
			>
				{#if open}
					{valueType === 'array' ? '[' : '{'}
				{:else}
					<span class="text-gray-400">{preview}</span>
				{/if}
			</button>
		{:else if valueType === 'string'}
			<span class="font-mono text-xs text-green-700">"{String(value)}"</span>
		{:else if valueType === 'number'}
			<span class="font-mono text-xs text-blue-700">{String(value)}</span>
		{:else if valueType === 'boolean'}
			<span class="font-mono text-xs text-red-600">{String(value)}</span>
		{:else if valueType === 'null'}
			<span class="font-mono text-xs italic text-gray-400">null</span>
		{:else}
			<span class="font-mono text-xs text-gray-600">{String(value)}</span>
		{/if}
	</div>

	{#if isExpandable && open}
		<div class="tree-children border-l border-gray-200">
			{#each entries as [childKey, childVal], i (childKey)}
				<JsonTreeNode
					value={childVal}
					keyName={valueType === 'array' ? i : childKey}
					depth={depth + 1}
					defaultOpen={depth < 1}
				/>
			{/each}
		</div>
		<div style="padding-left: {depth > 0 ? 16 : 0}px">
			<span class="font-mono text-xs text-gray-400">{valueType === 'array' ? ']' : '}'}</span>
		</div>
	{/if}
</div>
