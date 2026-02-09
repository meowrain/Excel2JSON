export type DataType = 'string' | 'number' | 'boolean' | 'date';

export type DateFormat =
	| 'YYYY-MM-DD'
	| 'YYYY/MM/DD'
	| 'YYYY-MM-DD HH:mm'
	| 'YYYY/MM/DD HH:mm'
	| 'YYYY-MM-DD HH:mm:ss'
	| 'timestamp';

export interface MappingConfig {
	/** Excel original header name (read-only) */
	source: string;
	/** Target key name in JSON output */
	target: string;
	/** Data type for conversion */
	type: DataType;
	/** Date format string (only used when type is 'date') */
	format?: DateFormat;
	/** If true, exclude this key from JSON when cell is empty */
	excludeIfEmpty: boolean;
	/** Default value when cell is empty and excludeIfEmpty is false */
	defaultValue?: string;
	/** Whether this column is included in output */
	enabled: boolean;
}

/** A single row of raw Excel data, keyed by original header */
export type RowData = Record<string, unknown>;

/** Template file structure for import/export */
export type MappingTemplate = Pick<
	MappingConfig,
	'source' | 'target' | 'type' | 'format' | 'excludeIfEmpty' | 'defaultValue'
>[];

/** Static mapping rule in Job Bundle output */
export interface StaticRule {
	type: 'static';
	source: string;
	target: string;
	dataType: DataType;
	format?: string;
}

/** Dynamic API enrichment rule */
export interface ApiEnrichmentRule {
	type: 'api_fetch';
	target_key: string;
	url_template: string;
	method: 'GET' | 'POST';
	headers?: Record<string, string>;
	body_template?: string;
	response_path: string;
	fallback_value?: unknown;
}

/** Submission configuration for final data push */
export interface SubmissionConfig {
	target_url: string;
	method: 'POST' | 'PUT';
	batch_size: number;
}

/** Final exported Job Bundle structure */
export interface JobBundle {
	meta: {
		version: string;
		generated_at: string;
	};
	config: {
		static_rules: StaticRule[];
		enrichment_rules: ApiEnrichmentRule[];
		submission: SubmissionConfig;
	};
	source_data: Record<string, unknown>[];
}
