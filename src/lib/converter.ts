import dayjs from 'dayjs';
import type {
	MappingConfig,
	RowData,
	DataType,
	MappingTemplate,
	ApiEnrichmentRule,
	SubmissionConfig,
	StaticRule,
	JobBundle,
	ValueMapItem,
	MappingFallback
} from './types.js';

/**
 * Check if a value is considered empty.
 */
function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

/**
 * Parse a target value string into the appropriate type.
 * Intelligently detects boolean, number, null, and JSON.
 */
function parseTargetValue(value: string): unknown {
	if (value === 'null' || value === '') return null;
	if (value === 'true') return true;
	if (value === 'false') return false;
	if (value === 'undefined') return undefined;

	// Try parsing as number
	const num = Number(value);
	if (!isNaN(num) && value !== '') return num;

	// Try parsing as JSON object/array
	if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
		try {
			return JSON.parse(value);
		} catch {
			// Not valid JSON, return as string
		}
	}

	return value;
}

/**
 * Apply dictionary mapping to a value.
 * Returns the mapped value or applies the fallback strategy.
 */
function applyDictionaryMapping(
	value: unknown,
	valueMapping: ValueMapItem[],
	fallback: MappingFallback,
	customValue?: string
): unknown {
	if (value === undefined || value === null) {
		return fallback === 'null' ? null : value;
	}

	const normalizedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

	// Try to find exact match in mapping
	const mappedItem = valueMapping.find(
		(item) => String(item.source) === normalizedValue
	);

	if (mappedItem) {
		return mappedItem.target;
	}

	// Apply fallback strategy
	switch (fallback) {
		case 'keep':
			return value;
		case 'null':
			return null;
		case 'custom':
			return customValue !== undefined ? parseTargetValue(customValue) : null;
		default:
			return value;
	}
}

/**
 * Convert a raw cell value to the specified data type.
 */
function convertValue(
	value: unknown,
	type: DataType,
	format?: string,
	mapping?: { enabled: boolean; items: ValueMapItem[]; fallback: MappingFallback; customValue?: string }
): unknown {
	if (isEmpty(value)) return undefined;

	// Apply dictionary mapping first (before type conversion)
	let processedValue = value;
	if (mapping?.enabled && mapping.items.length > 0) {
		processedValue = applyDictionaryMapping(value, mapping.items, mapping.fallback, mapping.customValue);
		if (processedValue === null && mapping.fallback === 'null') return null;
	}

	switch (type) {
		case 'number': {
			const num = Number(processedValue);
			return isNaN(num) ? processedValue : num;
		}
		case 'boolean': {
			if (typeof processedValue === 'boolean') return processedValue;
			const str = String(processedValue).toLowerCase().trim();
			if (['true', '1', 'yes', '是'].includes(str)) return true;
			if (['false', '0', 'no', '否'].includes(str)) return false;
			return Boolean(processedValue);
		}
		case 'date': {
			return formatDate(processedValue, format);
		}
		case 'string':
		default:
			if (processedValue instanceof Date) return dayjs(processedValue).format('YYYY-MM-DD HH:mm:ss');
			return String(processedValue);
	}
}

/**
 * Format a value as a date string. Handles Excel serial date numbers.
 */
function formatDate(value: unknown, format?: string): string | number {
	let date: dayjs.Dayjs;

	if (value instanceof Date) {
		date = dayjs(value);
	} else if (typeof value === 'number') {
		// Excel serial date: days since 1900-01-01 (with the 1900 leap year bug)
		// Use UTC to avoid timezone issues
		const excelEpochMs = Date.UTC(1899, 11, 30);
		const ms = excelEpochMs + value * 86400000;
		date = dayjs(new Date(ms));
	} else {
		date = dayjs(value as string);
	}

	if (!date.isValid()) return String(value);

	if (format === 'timestamp') {
		return date.unix();
	}

	return date.format(format || 'YYYY-MM-DD');
}

/**
 * Set a value at a dot-separated path, creating nested objects as needed.
 * e.g. setNested(obj, "user.address.city", "Beijing")
 *   => obj = { user: { address: { city: "Beijing" } } }
 */
function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
	if (!path.includes('.')) {
		obj[path] = value;
		return;
	}

	const keys = path.split('.');
	let current: Record<string, unknown> = obj;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
			current[key] = {};
		}
		current = current[key] as Record<string, unknown>;
	}

	current[keys[keys.length - 1]] = value;
}

/**
 * Convert raw Excel rows to JSON objects based on mapping configs.
 */
export function convertData(
	rows: RowData[],
	mappings: MappingConfig[]
): Record<string, unknown>[] {
	const enabledMappings = mappings.filter((m) => m.enabled);

	return rows.map((row) => {
		const obj: Record<string, unknown> = {};

		for (const mapping of enabledMappings) {
			const rawValue = row[mapping.source];
			const isEmptyVal = isEmpty(rawValue);

			if (isEmptyVal && mapping.excludeIfEmpty) {
				continue;
			}

			const finalValue = isEmptyVal
				? (mapping.defaultValue !== undefined && mapping.defaultValue !== ''
					? convertValue(
						mapping.defaultValue,
						mapping.type,
						mapping.format,
						mapping.useDictionary ? {
							enabled: true,
							items: mapping.valueMapping ?? [],
							fallback: mapping.mappingFallback ?? 'keep',
							customValue: mapping.mappingCustomValue
						} : undefined
					)
					: null)
				: convertValue(
					rawValue,
					mapping.type,
					mapping.format,
					mapping.useDictionary ? {
						enabled: true,
						items: mapping.valueMapping ?? [],
						fallback: mapping.mappingFallback ?? 'keep',
						customValue: mapping.mappingCustomValue
					} : undefined
				);

			setNested(obj, mapping.target, finalValue);
		}

		return obj;
	});
}

/**
 * Create default mapping configs from Excel headers.
 * Auto-detects date columns by sampling row data.
 */
export function createDefaultMappings(headers: string[], rows?: RowData[]): MappingConfig[] {
	return headers.map((header) => {
		const detectedType = rows ? detectColumnType(header, rows) : 'string';
		return {
			source: header,
			target: header,
			type: detectedType,
			format: detectedType === 'date' ? 'YYYY-MM-DD' : undefined,
			excludeIfEmpty: false,
			defaultValue: '',
			enabled: true
		};
	});
}

/**
 * Detect the data type of a column by sampling its values.
 */

/**
 * Scan unique values from a column for auto-filling dictionary mapping.
 * Limits to first 1000 rows for performance.
 */
export function scanUniqueValues(header: string, rows: RowData[]): (string | number)[] {
	const MAX_ROWS = 1000;
	const sample = rows.slice(0, MAX_ROWS);
	const uniqueValues = new Set<string | number>();

	for (const row of sample) {
		const val = row[header];
		if (val !== undefined && val !== null && val !== '') {
			const normalized = typeof val === 'object' ? JSON.stringify(val) : (val as string | number);
			uniqueValues.add(normalized);
		}
	}

	return Array.from(uniqueValues).sort();
}

function detectColumnType(header: string, rows: RowData[]): DataType {
	const sample = rows.slice(0, 20);
	let dateCount = 0;
	let totalNonEmpty = 0;

	for (const row of sample) {
		const val = row[header];
		if (val === undefined || val === null || val === '') continue;
		totalNonEmpty++;
		if (val instanceof Date) dateCount++;
	}

	if (totalNonEmpty > 0 && dateCount / totalNonEmpty >= 0.5) return 'date';
	return 'string';
}

/**
 * Apply a template to existing mappings. Matches by source header name.
 */
export function applyTemplate(
	currentMappings: MappingConfig[],
	template: MappingTemplate
): MappingConfig[] {
	const templateMap = new Map(template.map((t) => [t.source, t]));

	return currentMappings.map((mapping) => {
		const tmpl = templateMap.get(mapping.source);
		if (tmpl) {
			return {
				...mapping,
				target: tmpl.target,
				type: tmpl.type,
				format: tmpl.format,
				excludeIfEmpty: tmpl.excludeIfEmpty,
				defaultValue: tmpl.defaultValue ?? '',
				// v2.1: Apply dictionary mapping settings
				useDictionary: tmpl.useDictionary,
				valueMapping: tmpl.valueMapping,
				mappingFallback: tmpl.mappingFallback,
				mappingCustomValue: tmpl.mappingCustomValue
			};
		}
		return mapping;
	});
}

/**
 * Export current mappings as a template.
 */
export function exportTemplate(mappings: MappingConfig[]): MappingTemplate {
	return mappings.map(({ source, target, type, format, excludeIfEmpty, defaultValue, useDictionary, valueMapping, mappingFallback, mappingCustomValue }) => {
		const entry: MappingTemplate[number] = { source, target, type, excludeIfEmpty };
		if (type === 'date' && format) entry.format = format;
		if (defaultValue) entry.defaultValue = defaultValue;
		// v2.1: Export dictionary mapping settings
		if (useDictionary) entry.useDictionary = true;
		if (valueMapping && valueMapping.length > 0) entry.valueMapping = valueMapping;
		if (mappingFallback) entry.mappingFallback = mappingFallback;
		if (mappingCustomValue) entry.mappingCustomValue = mappingCustomValue;
		return entry;
	});
}

/**
 * Convert enabled MappingConfigs to StaticRule format for Job Bundle.
 */
function toStaticRules(mappings: MappingConfig[]): StaticRule[] {
	return mappings
		.filter((m) => m.enabled)
		.map((m) => {
			const rule: StaticRule = {
				type: 'static',
				source: m.source,
				target: m.target,
				dataType: m.type
			};
			if (m.type === 'date' && m.format) rule.format = m.format;
			// v2.1: Include dictionary mapping properties
			if (m.useDictionary && m.valueMapping && m.valueMapping.length > 0) {
				rule.useDictionary = true;
				rule.valueMapping = m.valueMapping;
				rule.mappingFallback = m.mappingFallback ?? 'keep';
				if (m.mappingFallback === 'custom') {
					rule.mappingCustomValue = m.mappingCustomValue;
				}
			}
			return rule;
		});
}

/**
 * Generate a complete Job Bundle for export.
 */
export function generateJobBundle(
	rows: RowData[],
	mappings: MappingConfig[],
	enrichmentRules: ApiEnrichmentRule[],
	submissionConfig: SubmissionConfig
): JobBundle {
	const sourceData = convertData(rows, mappings);
	const staticRules = toStaticRules(mappings);

	return {
		meta: {
			version: '1.0.0',
			generated_at: new Date().toISOString()
		},
		config: {
			static_rules: staticRules,
			enrichment_rules: enrichmentRules,
			submission: submissionConfig
		},
		source_data: sourceData
	};
}
