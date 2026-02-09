import { json, error } from '@sveltejs/kit';
import { sanitizeErrorMessage } from '$lib/utils/error-sanitizer.js';

interface ProxyRequest {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
}

const PROXY_TIMEOUT_MS = 10000; // 10 seconds timeout
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB max response size

/**
 * Sanitizes headers to prevent sensitive data leakage
 */
function sanitizeHeaders(headers: Headers): Record<string, string> {
	const sanitized: Record<string, string> = {};
	const safeHeaders = ['content-type', 'content-length', 'etag', 'last-modified', 'cache-control'];

	for (const [key, value] of headers.entries()) {
		const lowerKey = key.toLowerCase();
		// Only include safe headers
		if (safeHeaders.includes(lowerKey)) {
			sanitized[key] = value;
		}
	}

	return sanitized;
}

/**
 * Validates URL to prevent SSRF attacks
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
	try {
		const parsed = new URL(url);

		// Only allow HTTP/HTTPS
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return { valid: false, error: 'Only HTTP/HTTPS protocols are allowed' };
		}

		// Block private/local network addresses (basic SSRF protection)
		const hostname = parsed.hostname.toLowerCase();
		const blockedHosts = [
			'localhost',
			'127.0.0.1',
			'0.0.0.0',
			'[::1]',
			'169.254.169.254', // AWS metadata
			'metadata.google.internal' // GCP metadata
		];

		if (blockedHosts.some((h) => hostname === h || hostname.endsWith('.' + h))) {
			return { valid: false, error: 'Access to local/private addresses is not allowed' };
		}

		// Block private IP ranges
		const privateIpPatterns = [
			/^10\./,
			/^172\.(1[6-9]|2[0-9]|3[01])\./,
			/^192\.168\./,
			/^fc00:/i, // IPv6 private
			/^fe80:/i  // IPv6 link-local
		];

		if (privateIpPatterns.some((pattern) => pattern.test(hostname) || pattern.test(parsed.hostname))) {
			return { valid: false, error: 'Access to private IP addresses is not allowed' };
		}

		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}
}

export async function POST({ request }) {
	// Create abort controller for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

	try {
		const { url, method = 'GET', headers = {}, body }: ProxyRequest = await request.json();

		// Debug logging
		console.log('=== Proxy Request ===');
		console.log(`URL: ${url}`);
		console.log(`Method: ${method}`);
		console.log('Headers:', JSON.stringify(headers, null, 2));
		if (body !== undefined) {
			console.log('Body:', JSON.stringify(body, null, 2));
		}
		console.log('====================');

		// Basic validation
		if (!url || typeof url !== 'string') {
			return json({ error: 'Invalid URL' }, { status: 400 });
		}

		// URL validation with SSRF protection
		const urlValidation = validateUrl(url);
		if (!urlValidation.valid) {
			return json({ error: urlValidation.error }, { status: 400 });
		}

		// Prepare fetch options
		const fetchOptions: RequestInit = {
			method,
			headers: {
				'Content-Type': 'application/json',
				...headers
			},
			signal: controller.signal
		};

		// Add body for non-GET requests
		if (method !== 'GET' && body !== undefined) {
			fetchOptions.body = JSON.stringify(body);
		}

		// Make the proxied request
		const response = await fetch(url, fetchOptions);

		// Log response
		console.log('=== Proxy Response ===');
		console.log(`Status: ${response.status} ${response.statusText}`);
		console.log('=====================');

		// Check response size
		const contentLength = response.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
			return json({ error: 'Response too large' }, { status: 413 });
		}

		// Get response data with size limit
		const contentType = response.headers.get('content-type') || '';
		let responseData: unknown;

		if (contentType.includes('application/json')) {
			const text = await response.text();
			if (text.length > MAX_RESPONSE_SIZE) {
				return json({ error: 'Response too large' }, { status: 413 });
			}
			try {
				responseData = JSON.parse(text);
			} catch {
				responseData = text;
			}
		} else {
			const text = await response.text();
			if (text.length > MAX_RESPONSE_SIZE) {
				return json({ error: 'Response too large' }, { status: 413 });
			}
			responseData = text;
		}

		// Return response with same status, but sanitized headers
		// Include debug info for development
		return json(
			{
				data: responseData,
				status: response.status,
				headers: sanitizeHeaders(response.headers),
				_debug: {
					proxiedUrl: url,
					proxiedMethod: method,
					proxiedHeaders: headers
				}
			},
			{ status: response.status }
		);
	} catch (err) {
		// Handle timeout
		if (err instanceof Error && err.name === 'AbortError') {
			console.error('Proxy timeout');
			return json(
				{ error: 'Request timeout - the server took too long to respond (max 10 seconds)' },
				{ status: 504 }
			);
		}

		// Log error
		console.error('Proxy error:', err);

		// Sanitize error messages to prevent information leakage
		const sanitizedError = err instanceof Error ? sanitizeErrorMessage(err.message) : 'Proxy request failed';

		return json({ error: sanitizedError }, { status: 500 });
	} finally {
		clearTimeout(timeoutId);
	}
}
