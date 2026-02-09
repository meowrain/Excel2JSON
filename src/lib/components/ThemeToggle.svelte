<script lang="ts">
	import { themeStore, type Theme } from '$lib/stores/themeStore.svelte';

	let isOpen = $state(false);
	let selectedTheme = $derived(themeStore.theme);

	const themes: { value: Theme; icon: string; label: string }[] = [
		{ value: 'light', icon: '☀️', label: '浅色' },
		{ value: 'dark', icon: '🌙', label: '深色' },
		{ value: 'system', icon: '💻', label: '跟随系统' }
	];

	function setTheme(theme: Theme) {
		themeStore.setTheme(theme);
		isOpen = false;
	}

	function toggleDropdown(e: Event) {
		e.stopPropagation();
		isOpen = !isOpen;
	}

	// Close dropdown when clicking outside
	$effect(() => {
		if (isOpen) {
			const handler = () => (isOpen = false);
			document.addEventListener('click', handler);
			return () => document.removeEventListener('click', handler);
		}
	});
</script>

<div class="relative">
	<!-- Toggle Button -->
	<button
		onclick={toggleDropdown}
		class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 transition-colors"
		title="切换主题"
		aria-label="切换主题"
	>
		<span class="text-lg">{themes.find((t) => t.value === selectedTheme)?.icon}</span>
	</button>

	<!-- Theme Dropdown -->
	{#if isOpen}
		<div class="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
			{#each themes as theme}
				<button
					onclick={() => setTheme(theme.value)}
					class="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
					class:text-slate-700={selectedTheme !== theme.value}
					class:text-slate-900={selectedTheme === theme.value}
					class:hover:bg-slate-50={selectedTheme !== theme.value}
					class:bg-slate-50={selectedTheme === theme.value}
					class:dark:text-slate-300={selectedTheme !== theme.value}
					class:dark:text-slate-100={selectedTheme === theme.value}
					class:dark:hover:bg-slate-700={selectedTheme !== theme.value}
					class:dark:bg-slate-700={selectedTheme === theme.value}
				>
					<span class="text-base">{theme.icon}</span>
					<span>{theme.label}</span>
					{#if selectedTheme === theme.value}
						<span class="ml-auto text-indigo-600 dark:text-indigo-400">✓</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
