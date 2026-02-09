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
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={onclose} role="presentation">
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-semibold text-gray-800">提交设置</h3>
			<button onclick={onclose} aria-label="关闭" class="cursor-pointer text-gray-400 hover:text-gray-600">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="space-y-4">
			<div>
				<label for="target-url" class="mb-1 block text-sm font-medium text-gray-700">Target URL</label>
				<input
					id="target-url"
					type="text"
					bind:value={localConfig.target_url}
					placeholder="https://api.db.com/bulk-insert"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="method" class="mb-1 block text-sm font-medium text-gray-700">Method</label>
				<select
					id="method"
					bind:value={localConfig.method}
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				>
					<option value="POST">POST</option>
					<option value="PUT">PUT</option>
				</select>
			</div>

			<div>
				<label for="batch-size" class="mb-1 block text-sm font-medium text-gray-700">Batch Size</label>
				<input
					id="batch-size"
					type="number"
					bind:value={localConfig.batch_size}
					min="1"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
			</div>
		</div>

		<div class="mt-6 flex justify-end gap-2">
			<button
				onclick={onclose}
				class="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
			>
				取消
			</button>
			<button
				onclick={save}
				class="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
			>
				保存
			</button>
		</div>
	</div>
</div>
