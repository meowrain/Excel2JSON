import dayjs from 'dayjs';
import type {
	MappingConfig,
	RowData,
	DataType,
	MappingTemplate,
	ApiEnrichmentRule,
	SubmissionConfig,
	StaticRule,
	JobBundle
} from './types.js';

/**
 * Check if a value is considered empty.
 */
function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

/**
 * Convert a raw cell value to the specified data type.
 */
function convertValue(value: unknown, type: DataType, format?: string): unknown {
	if (isEmpty(value)) return undefined;

	switch (type) {
		case 'number': {
			const num = Number(value);
			return isNaN(num) ? value : num;
		}
		case 'boolean': {
			if (typeof value === 'boolean') return value;
			const str = String(value).toLowerCase().trim();
			if (['true', '1', 'yes', '是'].includes(str)) return true;
			if (['false', '0', 'no', '否'].includes(str)) return false;
			return Boolean(value);
		}
		case 'date': {
			return formatDate(value, format);
		}
		case 'string':
		default:
			if (value instanceof Date) return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
			return String(value);
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
					? convertValue(mapping.defaultValue, mapping.type, mapping.format)
					: null)
				: convertValue(rawValue, mapping.type, mapping.format);

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
				defaultValue: tmpl.defaultValue ?? ''
			};
		}
		return mapping;
	});
}

/**
 * Export current mappings as a template.
 */
export function exportTemplate(mappings: MappingConfig[]): MappingTemplate {
	return mappings.map(({ source, target, type, format, excludeIfEmpty, defaultValue }) => {
		const entry: MappingTemplate[number] = { source, target, type, excludeIfEmpty };
		if (type === 'date' && format) entry.format = format;
		if (defaultValue) entry.defaultValue = defaultValue;
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
