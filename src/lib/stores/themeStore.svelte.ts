/**
 * Theme type definition
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Get the system theme preference
 */
function getSystemTheme(): 'light' | 'dark' {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the effective theme (resolving 'system' to actual theme)
 */
function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
	if (theme === 'system') {
		return getSystemTheme();
	}
	return theme;
}

/**
 * Theme state management
 */
class ThemeStore {
	theme = $state<Theme>('system');
	private listeners: Set<(theme: 'light' | 'dark') => void> = new Set();
	private mediaQuery: MediaQueryList | null = null;

	constructor() {
		// Load from localStorage
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('theme') as Theme | null;
			if (stored && (stored === 'light' || stored === 'dark' || stored === 'system')) {
				this.theme = stored;
			}

			// Listen for system theme changes
			this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			this.mediaQuery.addEventListener('change', () => {
				if (this.theme === 'system') {
					this.notify();
				}
			});
		}
	}

	/**
	 * Get the current effective theme (light or dark)
	 */
	get currentTheme(): 'light' | 'dark' {
		return getEffectiveTheme(this.theme);
	}

	/**
	 * Set the theme
	 */
	setTheme(theme: Theme) {
		this.theme = theme;
		if (typeof window !== 'undefined') {
			localStorage.setItem('theme', theme);
		}
		this.notify();
		this.applyTheme();
	}

	/**
	 * Toggle between light and dark
	 */
	toggle() {
		const effective = this.currentTheme;
		this.setTheme(effective === 'light' ? 'dark' : 'light');
	}

	/**
	 * Subscribe to theme changes
	 */
	subscribe(callback: (theme: 'light' | 'dark') => void): () => void {
		this.listeners.add(callback);
		callback(this.currentTheme);

		return () => {
			this.listeners.delete(callback);
		};
	}

	private notify() {
		const effective = this.currentTheme;
		this.listeners.forEach((callback) => callback(effective));
	}

	/**
	 * Apply theme to document
	 */
	applyTheme() {
		if (typeof document === 'undefined') return;

		const effective = this.currentTheme;
		const root = document.documentElement;

		if (effective === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
	}

	/**
	 * Initialize theme on app load
	 */
	init() {
		// Apply theme immediately without transition
		if (typeof document !== 'undefined') {
			document.documentElement.classList.add('no-transition');
			this.applyTheme();
			// Force reflow
			document.documentElement.offsetHeight;
			// Remove no-transition after a frame
			requestAnimationFrame(() => {
				document.documentElement.classList.remove('no-transition');
			});
		}
	}
}

// Export singleton instance
export const themeStore = new ThemeStore();
