/**
 * Proxy utility functions for API enrichment testing
 * Handles template variable replacement and proxied fetch requests
 */

interface ProxyOptions {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: unknown;
}

interface ProxyResponse {
	data: unknown;
	status: number;
	headers: Record<string, string>;
}

/**
 * Makes a proxied API request through the SvelteKit backend
 * This bypasses CORS restrictions and provides consistent error handling
 *
 * @param options - Request configuration
 * @returns Promise with response data, status, and headers
 * @throws Error if proxy request fails
 */
export async function proxyFetch(options: ProxyOptions): Promise<ProxyResponse> {
	const response = await fetch('/api/proxy', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(options)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: response.statusText }));
		throw new Error(errorData.error || `Proxy Error: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Replaces template variables in a string with actual values
 * Supports {{variable}} syntax for substitution
 *
 * @example
 * ```ts
 * renderTemplate("https://api.com/users/{{id}}", { id: 123 })
 * // Returns: "https://api.com/users/123"
 * renderTemplate("https://api.com/?name={{服务商}}", { 服务商: "Baidu" })
 * // Returns: "https://api.com/?name=Baidu"
 * ```
 *
 * @param template - String containing {{variable}} placeholders
 * @param context - Object mapping variable names to values
 * @returns String with all variables replaced
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
	return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key) => {
		const value = context[key.trim()];
		return value !== undefined && value !== null ? String(value) : '';
	});
}

/**
 * Safely extracts a value from a nested object using dot notation
 * Returns undefined if the path cannot be resolved
 *
 * @example
 * ```ts
 * extractByPath({ data: { user: { name: "Alice" } } }, "data.user.name")
 * // Returns: "Alice"
 * ```
 *
 * @param obj - Object to extract from
 * @param path - Dot-notation path (e.g., "data.user.name")
 * @returns Extracted value or undefined
 */
export function extractByPath(obj: unknown, path: string): unknown {
	if (!path) return obj;

	const keys = path.split('.');
	let current: unknown = obj;

	for (const key of keys) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof current !== 'object') {
			return undefined;
		}
		current = (current as Record<string, unknown>)[key];
	}

	return current;
}

/**
 * Validates if a string contains template variables
 * @param str - String to check
 * @returns true if string contains {{variable}} patterns
 */
export function hasTemplateVariables(str: string): boolean {
	return /\{\{\s*\w+\s*\}\}/.test(str);
}

/**
 * Extracts all variable names from a template string
 * @param template - String containing {{variable}} placeholders
 * @returns Array of unique variable names
 */
export function extractVariableNames(template: string): string[] {
	const matches = template.match(/\{\{\s*(\w+)\s*\}\}/g);
	if (!matches) return [];

	return [...new Set(matches.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, '')))];
}
