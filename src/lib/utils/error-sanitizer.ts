/**
 * Error message sanitization utility
 * Prevents sensitive information leakage in error messages
 */

// Patterns that might indicate sensitive information
const SENSITIVE_PATTERNS = [
	// Password/secret related
	/password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|auth/i,
	// File paths
	/[a-z]:[\\/][^\s]*/i, // Windows paths
	/\/(?:home|usr|var|etc|root)[\\/][^\s]*/i, // Unix paths
	// Stack trace patterns
	/\s+at\s+.*\s+\(\s*[^)]+\s*\)/,
	/from\s+[^\/\s]+\/[^\/\s]+\.js/,
	// Internal server details
	/localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i,
	// Database connection strings
	/mongodb|mysql|postgres|redis|sqlite[:+]/i,
	/aws_access_key_id|aws_secret_access_key/i
];

/**
 * Sanitizes an error message to prevent sensitive information leakage
 *
 * @param message - The raw error message
 * @returns A sanitized error message safe to show to users
 */
export function sanitizeErrorMessage(message: string): string {
	if (!message || typeof message !== 'string') {
		return 'An error occurred';
	}

	let sanitized = message;

	// Remove or mask sensitive patterns
	for (const pattern of SENSITIVE_PATTERNS) {
		sanitized = sanitized.replace(pattern, '[REDACTED]');
	}

	// Limit length to prevent excessive error messages
	const MAX_LENGTH = 200;
	if (sanitized.length > MAX_LENGTH) {
		sanitized = sanitized.slice(0, MAX_LENGTH) + '...';
	}

	// Ensure we have a non-empty message
	if (!sanitized.trim()) {
		return 'An error occurred while processing your request';
	}

	return sanitized;
}

/**
 * Creates a safe error object for API responses
 *
 * @param error - The original error
 * @returns A sanitized error object
 */
export function createSafeError(error: unknown): { error: string; code?: string } {
	if (error instanceof Error) {
		return {
			error: sanitizeErrorMessage(error.message),
			code: error.name || 'ERROR'
		};
	}

	if (typeof error === 'string') {
		return {
			error: sanitizeErrorMessage(error),
			code: 'ERROR'
		};
	}

	return {
		error: 'An unexpected error occurred',
		code: 'UNKNOWN_ERROR'
	};
}
