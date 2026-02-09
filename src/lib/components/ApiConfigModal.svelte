<script lang="ts">
	import type { ApiEnrichmentRule } from '$lib/types.js';

	let {
		rule,
		headers,
		onsave,
		onclose
	}: {
		rule?: ApiEnrichmentRule;
		headers: string[];
		onsave: (rule: ApiEnrichmentRule) => void;
		onclose: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally — intentionally using initial values only
	let targetKey = $state(rule?.target_key ?? '');
	// svelte-ignore state_referenced_locally
	let urlTemplate = $state(rule?.url_template ?? '');
	// svelte-ignore state_referenced_locally
	let method = $state<'GET' | 'POST'>(rule?.method ?? 'GET');
	// svelte-ignore state_referenced_locally
	let headerEntries = $state<{ key: string; value: string }[]>(
		rule?.headers ? Object.entries(rule.headers).map(([key, value]) => ({ key, value })) : []
	);
	// svelte-ignore state_referenced_locally
	let bodyTemplate = $state(rule?.body_template ?? '');
	// svelte-ignore state_referenced_locally
	let responsePath = $state(rule?.response_path ?? '');
	// svelte-ignore state_referenced_locally
	let fallbackValue = $state(rule?.fallback_value != null ? String(rule.fallback_value) : '');

	let showUrlVars = $state(false);
	let showBodyVars = $state(false);

	let urlInput: HTMLInputElement | undefined = $state();
	let bodyTextarea: HTMLTextAreaElement | undefined = $state();

	function insertVariable(field: 'url' | 'body', header: string) {
		const variable = `{{${header}}}`;
		if (field === 'url') {
			if (urlInput) {
				const start = urlInput.selectionStart ?? urlTemplate.length;
				urlTemplate = urlTemplate.slice(0, start) + variable + urlTemplate.slice(urlInput.selectionEnd ?? start);
			} else {
				urlTemplate += variable;
			}
			showUrlVars = false;
		} else {
			if (bodyTextarea) {
				const start = bodyTextarea.selectionStart ?? bodyTemplate.length;
				bodyTemplate = bodyTemplate.slice(0, start) + variable + bodyTemplate.slice(bodyTextarea.selectionEnd ?? start);
			} else {
				bodyTemplate += variable;
			}
			showBodyVars = false;
		}
	}

	function addHeader() {
		headerEntries = [...headerEntries, { key: '', value: '' }];
	}

	function removeHeader(index: number) {
		headerEntries = headerEntries.filter((_, i) => i !== index);
	}

	function save() {
		if (!targetKey.trim() || !urlTemplate.trim() || !responsePath.trim()) return;

		const headersObj: Record<string, string> = {};
		for (const entry of headerEntries) {
			if (entry.key.trim()) {
				headersObj[entry.key.trim()] = entry.value;
			}
		}

		const newRule: ApiEnrichmentRule = {
			type: 'api_fetch',
			target_key: targetKey.trim(),
			url_template: urlTemplate.trim(),
			method,
			response_path: responsePath.trim()
		};

		if (Object.keys(headersObj).length > 0) newRule.headers = headersObj;
		if (method === 'POST' && bodyTemplate.trim()) newRule.body_template = bodyTemplate.trim();
		if (fallbackValue !== '') newRule.fallback_value = fallbackValue;

		onsave(newRule);
	}

	const isValid = $derived(targetKey.trim() !== '' && urlTemplate.trim() !== '' && responsePath.trim() !== '');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={onclose} role="presentation">
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-semibold text-gray-800">
				{rule ? '编辑' : '添加'} API 字段
			</h3>
			<button onclick={onclose} aria-label="关闭" class="cursor-pointer text-gray-400 hover:text-gray-600">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="space-y-4">
			<!-- Target Key -->
			<div>
				<label for="api-target-key" class="mb-1 block text-sm font-medium text-gray-700">Target Key</label>
				<input
					id="api-target-key"
					type="text"
					bind:value={targetKey}
					placeholder="user_balance"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
				<p class="mt-1 text-xs text-gray-400">最终 JSON 中的字段名</p>
			</div>

			<!-- Request URL -->
			<div>
				<label for="api-url" class="mb-1 block text-sm font-medium text-gray-700">Request URL</label>
				<div class="flex gap-1">
					<input
						id="api-url"
						type="text"
						bind:this={urlInput}
						bind:value={urlTemplate}
						placeholder={"https://api.example.com/users/{{用户ID}}/detail"}
						class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
					<div class="relative">
						<button
							onclick={() => { showUrlVars = !showUrlVars; showBodyVars = false; }}
							class="cursor-pointer whitespace-nowrap rounded-md border border-gray-300 px-2 py-2 text-xs text-gray-600 hover:bg-gray-50"
							title="插入变量"
						>
							&#123;&#123;x&#125;&#125;
						</button>
						{#if showUrlVars}
							<div class="absolute right-0 z-10 mt-1 max-h-48 w-40 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
								{#each headers as h (h)}
									<button
										onclick={() => insertVariable('url', h)}
										class="w-full cursor-pointer px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-blue-50"
									>
										{h}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
				<p class="mt-1 text-xs text-gray-400">支持 &#123;&#123;列名&#125;&#125; 模板变量</p>
			</div>

			<!-- Request Method -->
			<div>
				<label for="api-method" class="mb-1 block text-sm font-medium text-gray-700">Request Method</label>
				<select
					id="api-method"
					bind:value={method}
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				>
					<option value="GET">GET</option>
					<option value="POST">POST</option>
				</select>
			</div>

			<!-- Headers -->
			<div>
				<div class="mb-1 flex items-center justify-between">
					<span class="text-sm font-medium text-gray-700">Headers</span>
					<button onclick={addHeader} class="cursor-pointer text-xs text-blue-600 hover:text-blue-700">
						+ 添加
					</button>
				</div>
				{#if headerEntries.length > 0}
					<div class="space-y-2">
						{#each headerEntries as entry, i (i)}
							<div class="flex items-center gap-1">
								<input
									type="text"
									bind:value={entry.key}
									placeholder="Key"
									class="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								/>
								<input
									type="text"
									bind:value={entry.value}
									placeholder="Value"
									class="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								/>
								<button
									onclick={() => removeHeader(i)}
									class="cursor-pointer flex-shrink-0 text-gray-400 hover:text-red-500"
									aria-label="删除此 Header"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-xs text-gray-400">暂无 Header</p>
				{/if}
			</div>

			<!-- Body (POST only) -->
			{#if method === 'POST'}
				<div>
					<div class="mb-1 flex items-center justify-between">
						<label for="api-body" class="text-sm font-medium text-gray-700">Request Body</label>
						<div class="relative">
							<button
								onclick={() => { showBodyVars = !showBodyVars; showUrlVars = false; }}
								class="cursor-pointer text-xs text-blue-600 hover:text-blue-700"
							>
								插入变量
							</button>
							{#if showBodyVars}
								<div class="absolute right-0 z-10 mt-1 max-h-48 w-40 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
									{#each headers as h (h)}
										<button
											onclick={() => insertVariable('body', h)}
											class="w-full cursor-pointer px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-blue-50"
										>
											{h}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
					<textarea
						id="api-body"
						bind:this={bodyTextarea}
						bind:value={bodyTemplate}
						rows="4"
						placeholder={'{"user_id": "{{用户ID}}"}'}
						class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					></textarea>
				</div>
			{/if}

			<!-- Response Path -->
			<div>
				<label for="api-response-path" class="mb-1 block text-sm font-medium text-gray-700">Response Extractor</label>
				<input
					id="api-response-path"
					type="text"
					bind:value={responsePath}
					placeholder="data.balance"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
				<p class="mt-1 text-xs text-gray-400">从接口返回 JSON 中提取值的路径（如 data.result.value）</p>
			</div>

			<!-- Fallback Value -->
			<div>
				<label for="api-fallback" class="mb-1 block text-sm font-medium text-gray-700">Fallback Value</label>
				<input
					id="api-fallback"
					type="text"
					bind:value={fallbackValue}
					placeholder="null"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
				<p class="mt-1 text-xs text-gray-400">API 请求失败时的默认值</p>
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
				disabled={!isValid}
				class="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				保存
			</button>
		</div>
	</div>
</div>
