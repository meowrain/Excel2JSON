<script lang="ts">
	import type { SubmissionConfig } from '$lib/types.js';

	let {
		config = $bindable(),
		onclose
	}: {
		config: SubmissionConfig;
		onclose: () => void;
	} = $props();

	let localConfig = $state<SubmissionConfig>({ ...config });

	function save() {
		config.target_url = localConfig.target_url;
		config.method = localConfig.method;
		config.batch_size = localConfig.batch_size;
		onclose();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60" onclick={onclose} role="presentation">
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800" onclick={(e) => e.stopPropagation()}>
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200">提交设置</h3>
			<button onclick={onclose} aria-label="关闭" class="cursor-pointer text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="space-y-4">
			<div>
				<label for="target-url" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Target URL</label>
				<input
					id="target-url"
					type="text"
					bind:value={localConfig.target_url}
					placeholder="https://api.db.com/bulk-insert"
					class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
				/>
			</div>

			<div>
				<label for="method" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Method</label>
				<select
					id="method"
					bind:value={localConfig.method}
					class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
				>
					<option value="POST">POST</option>
					<option value="PUT">PUT</option>
				</select>
			</div>

			<div>
				<label for="batch-size" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Batch Size</label>
				<input
					id="batch-size"
					type="number"
					bind:value={localConfig.batch_size}
					min="1"
					class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
				/>
			</div>
		</div>

		<div class="mt-6 flex justify-end gap-2">
			<button
				onclick={onclose}
				class="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
			>
				取消
			</button>
			<button
				onclick={save}
				class="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
			>
				保存
			</button>
		</div>
	</div>
</div>
