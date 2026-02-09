<script lang="ts">
	import type { ApiEnrichmentRule } from '$lib/types.js';
	import { proxyFetch, renderTemplate, extractByPath, extractVariableNames } from '$lib/utils/proxy.js';

	let {
		rule,
		headers,
		testSample,
		onsave,
		onclose
	}: {
		rule?: ApiEnrichmentRule;
		headers: string[];
		testSample: Record<string, unknown>;
		onsave: (rule: ApiEnrichmentRule) => void;
		onclose: () => void;
	} = $props();

	// Form state
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

	// UI state
	let showUrlVars = $state(false);
	let showBodyVars = $state(false);
	let urlInput: HTMLInputElement | undefined = $state();
	let bodyTextarea: HTMLTextAreaElement | undefined = $state();

	// Test connection state
	let testContext = $state<Record<string, string>>({});
	let isTestRunning = $state(false);
	let testResult = $state<{
		status: number;
		statusText: string;
		response: unknown;
		extractedValue: unknown;
		timestamp: string;
		debug?: {
			proxiedUrl: string;
			proxiedMethod: string;
			proxiedHeaders: Record<string, string>;
		};
	} | null>(null);
	let testError = $state<string | null>(null);
	let showTestSection = $state(false);

	// Initialize test context from sample data
	$effect(() => {
		// Use the raw sample data directly as context
		// This ensures the variable names in templates match the actual data keys
		testContext = Object.fromEntries(
			Object.entries(testSample).map(([key, value]) => [
				key,
				value != null ? String(value) : ''
			])
		);
	});

	const isValid = $derived(targetKey.trim() !== '' && urlTemplate.trim() !== '' && responsePath.trim() !== '');
	const canTest = $derived(
		urlTemplate.trim() !== '' &&
		responsePath.trim() !== '' &&
		Object.keys(testContext).length > 0
	);

	// Variable names in templates
	const urlVariables = $derived(extractVariableNames(urlTemplate));
	const bodyVariables = $derived(extractVariableNames(bodyTemplate));

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

	async function testConnection() {
		isTestRunning = true;
		testResult = null;
		testError = null;

		try {
			// Prepare URL
			const renderedUrl = renderTemplate(urlTemplate, testContext);
			if (!renderedUrl) {
				throw new Error('URL 模板渲染后为空，请检查测试样本值');
			}

			// Prepare headers with template variable replacement
			const headersObj: Record<string, string> = {};
			for (const entry of headerEntries) {
				if (entry.key.trim()) {
					headersObj[entry.key.trim()] = renderTemplate(entry.value, testContext);
				}
			}

			// Prepare body for POST
			let requestBody: unknown = undefined;
			if (method === 'POST' && bodyTemplate.trim()) {
				const renderedBody = renderTemplate(bodyTemplate, testContext);
				try {
					requestBody = JSON.parse(renderedBody);
				} catch {
					requestBody = renderedBody;
				}
			}

			// Store actual request details for debug display
			const actualRequest = {
				url: renderedUrl,
				method,
				headers: headersObj,
				body: requestBody
			};

			// Make proxy request
			const response = await proxyFetch(actualRequest);

			// Extract value using response path
			const extractedValue = extractByPath(response.data, responsePath);

			testResult = {
				status: response.status,
				statusText: getStatusText(response.status),
				response: response.data,
				extractedValue,
				timestamp: new Date().toLocaleTimeString(),
				debug: {
					proxiedUrl: actualRequest.url,
					proxiedMethod: actualRequest.method,
					proxiedHeaders: actualRequest.headers
				}
			};
		} catch (e) {
			testError = e instanceof Error ? e.message : '测试请求失败';
		} finally {
			isTestRunning = false;
		}
	}

	function getStatusText(status: number): string {
		if (status >= 200 && status < 300) return 'OK';
		if (status >= 300 && status < 400) return 'Redirect';
		if (status === 400) return 'Bad Request';
		if (status === 401) return 'Unauthorized';
		if (status === 403) return 'Forbidden';
		if (status === 404) return 'Not Found';
		if (status >= 500) return 'Server Error';
		return 'Unknown';
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

	function formatTestValue(value: unknown): string {
		if (value === undefined) return 'undefined';
		if (value === null) return 'null';
		if (typeof value === 'object') return JSON.stringify(value, null, 2);
		return String(value);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={onclose} role="presentation">
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-slate-900" onclick={(e) => e.stopPropagation()}>
		<div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
			<h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200">
				{rule ? '编辑' : '添加'} API 字段
			</h3>
			<button onclick={onclose} aria-label="关闭" class="cursor-pointer text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="p-6">
			<div class="space-y-4">
				<!-- Target Key -->
				<div>
					<label for="api-target-key" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Target Key</label>
					<input
						id="api-target-key"
						type="text"
						bind:value={targetKey}
						placeholder="user_balance"
						class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
					/>
					<p class="mt-1 text-xs text-slate-400 dark:text-slate-500">最终 JSON 中的字段名</p>
				</div>

				<!-- Request URL -->
				<div>
					<label for="api-url" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Request URL</label>
					<div class="flex gap-1">
						<input
							id="api-url"
							type="text"
							bind:this={urlInput}
							bind:value={urlTemplate}
							placeholder={"https://api.example.com/users/{{用户ID}}/detail"}
							class="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
						/>
						<div class="relative">
							<button
								onclick={() => { showUrlVars = !showUrlVars; showBodyVars = false; }}
								class="cursor-pointer whitespace-nowrap rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
								title="插入变量"
							>
								&#123;&#123;x&#125;&#125;
							</button>
							{#if showUrlVars}
								<div class="absolute right-0 z-20 mt-1 max-h-48 w-40 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
									{#each headers as h (h)}
										<button
											onclick={() => insertVariable('url', h)}
											class="w-full cursor-pointer px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-slate-700"
										>
											{h}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
					<p class="mt-1 text-xs text-slate-400 dark:text-slate-500">支持 &#123;&#123;列名&#125;&#125; 模板变量</p>
					{#if urlVariables.length > 0}
						<div class="mt-1 flex flex-wrap gap-1">
							{#each urlVariables as v}
								<span class="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
									&#123;&#123;{v}&#125;&#125;
								</span>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Request Method -->
				<div>
					<label for="api-method" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Request Method</label>
					<select
						id="api-method"
						bind:value={method}
						class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
					>
						<option value="GET">GET</option>
						<option value="POST">POST</option>
					</select>
				</div>

				<!-- Headers -->
				<div>
					<div class="mb-1 flex items-center justify-between">
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Headers</span>
						<button onclick={addHeader} class="cursor-pointer text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
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
										class="flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
									/>
									<input
										type="text"
										bind:value={entry.value}
										placeholder="Value"
										class="flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
									/>
									<button
										onclick={() => removeHeader(i)}
										class="cursor-pointer flex-shrink-0 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
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
						<p class="text-xs text-slate-400 dark:text-slate-500">暂无 Header</p>
					{/if}
				</div>

				<!-- Body (POST only) -->
				{#if method === 'POST'}
					<div>
						<div class="mb-1 flex items-center justify-between">
							<label for="api-body" class="text-sm font-medium text-slate-700 dark:text-slate-300">Request Body</label>
							<div class="relative">
								<button
									onclick={() => { showBodyVars = !showBodyVars; showUrlVars = false; }}
									class="cursor-pointer text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
								>
									插入变量
								</button>
								{#if showBodyVars}
									<div class="absolute right-0 z-20 mt-1 max-h-48 w-40 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
										{#each headers as h (h)}
											<button
												onclick={() => insertVariable('body', h)}
												class="w-full cursor-pointer px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-slate-700"
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
							class="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
						></textarea>
						{#if bodyVariables.length > 0}
							<div class="mt-1 flex flex-wrap gap-1">
								{#each bodyVariables as v}
									<span class="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
										&#123;&#123;{v}&#125;&#125;
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Response Path -->
				<div>
					<label for="api-response-path" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Response Extractor</label>
					<input
						id="api-response-path"
						type="text"
						bind:value={responsePath}
						placeholder="data.balance"
						class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
					/>
					<p class="mt-1 text-xs text-slate-400 dark:text-slate-500">从接口返回 JSON 中提取值的路径（如 data.result.value）</p>
				</div>

				<!-- Fallback Value -->
				<div>
					<label for="api-fallback" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Fallback Value</label>
					<input
						id="api-fallback"
						type="text"
						bind:value={fallbackValue}
						placeholder="null"
						class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
					/>
					<p class="mt-1 text-xs text-slate-400 dark:text-slate-500">API 请求失败时的默认值</p>
				</div>

				<!-- Test Connection Section -->
				<div class="rounded-md border border-slate-200 dark:border-slate-700">
					<button
						onclick={() => (showTestSection = !showTestSection)}
						class="flex w-full items-center justify-between rounded-t-md bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
					>
						<span class="flex items-center gap-2">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							测试连接
						</span>
						<svg
							class="h-4 w-4 transition-transform {showTestSection ? 'rotate-180' : ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{#if showTestSection}
						<div class="border-t border-slate-200 p-4 dark:border-slate-700">
							<!-- Test Context -->
							<div class="mb-4">
								<label class="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
									测试上下文（可编辑）
								</label>
								<div class="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
									{#each headers as header (header)}
										<div class="flex items-center gap-2">
											<label class="min-w-20 truncate text-xs text-slate-500 dark:text-slate-400">{header}:</label>
											<input
												type="text"
												bind:value={testContext[header]}
												class="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
											/>
										</div>
									{/each}
								</div>
							</div>

							<!-- Test Button -->
							<button
								onclick={testConnection}
								disabled={!canTest || isTestRunning}
								class="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 cursor-pointer"
							>
								{#if isTestRunning}
									<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									测试中...
								{:else}
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
									</svg>
									发送测试请求
								{/if}
							</button>

							<!-- Test Error -->
							{#if testError}
								<div class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
									<div class="flex items-start gap-2">
										<svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<span>{testError}</span>
									</div>
								</div>
							{/if}

							<!-- Test Result -->
							{#if testResult}
								<div class="space-y-3">
									<!-- Status -->
									<div class="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">
										<span class="text-sm text-slate-600 dark:text-slate-400">HTTP 状态</span>
										<span class="flex items-center gap-2 text-sm font-medium">
											<span class="{testResult.status >= 200 && testResult.status < 300 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
												{testResult.status} {testResult.statusText}
											</span>
											<span class="text-xs text-slate-400">{testResult.timestamp}</span>
										</span>
									</div>

									<!-- Extracted Result -->
									<div class="rounded-md bg-slate-50 p-3 dark:bg-slate-800">
										<div class="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">提取结果</div>
										{#if testResult.extractedValue === undefined}
											<div class="flex items-center gap-2 text-amber-600 dark:text-amber-400">
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
												</svg>
												<span class="text-sm">未找到路径 "{responsePath}" 对应的值</span>
											</div>
										{:else}
											<pre class="overflow-x-auto bg-slate-100 p-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">{formatTestValue(testResult.extractedValue)}</pre>
										{/if}
									</div>

									<!-- Response Preview (collapsible) -->
									<details class="group">
										<summary class="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
											原始响应 JSON
										</summary>
										<pre class="mt-2 max-h-48 overflow-auto bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">{JSON.stringify(testResult.response, null, 2)}</pre>
									</details>

									<!-- Debug Info (collapsible) -->
									{#if testResult.debug}
										<details class="group" open>
											<summary class="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
												实际请求详情 (调试)
											</summary>
											<div class="mt-2 space-y-2 rounded-md bg-indigo-50 p-3 dark:bg-indigo-900/20">
												<div>
													<div class="text-xs font-medium text-indigo-700 dark:text-indigo-300">请求 URL</div>
													<pre class="mt-1 break-all bg-indigo-100 p-2 text-xs text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">{testResult.debug.proxiedUrl}</pre>
												</div>
												<div>
													<div class="text-xs font-medium text-indigo-700 dark:text-indigo-300">请求方法</div>
													<div class="mt-1 bg-indigo-100 p-2 text-xs text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">{testResult.debug.proxiedMethod}</div>
												</div>
												<div>
													<div class="text-xs font-medium text-indigo-700 dark:text-indigo-300">请求 Headers</div>
													<pre class="mt-1 bg-indigo-100 p-2 text-xs text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">{JSON.stringify(testResult.debug.proxiedHeaders, null, 2)}</pre>
												</div>
											</div>
										</details>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
			<button
				onclick={onclose}
				class="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
			>
				取消
			</button>
			<button
				onclick={save}
				disabled={!isValid}
				class="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
			>
				保存
			</button>
		</div>
	</div>
</div>
