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
