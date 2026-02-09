import { describe, it, expect } from 'vitest';
import { convertData, createDefaultMappings, applyTemplate, exportTemplate } from '$lib/converter.js';
import type { MappingConfig, RowData } from '$lib/types.js';

describe('createDefaultMappings', () => {
	it('creates mappings from headers with correct defaults', () => {
		const mappings = createDefaultMappings(['姓名', '年龄']);
		expect(mappings).toHaveLength(2);
		expect(mappings[0]).toEqual({
			source: '姓名',
			target: '姓名',
			type: 'string',
			format: undefined,
			excludeIfEmpty: false,
			defaultValue: '',
			enabled: true
		});
	});

	it('auto-detects date columns from row data', () => {
		const rows: RowData[] = [
			{ name: 'Alice', birthday: new Date('2000-01-01') },
			{ name: 'Bob', birthday: new Date('1995-06-15') }
		];
		const mappings = createDefaultMappings(['name', 'birthday'], rows);
		expect(mappings[0].type).toBe('string');
		expect(mappings[1].type).toBe('date');
		expect(mappings[1].format).toBe('YYYY-MM-DD');
	});
});

describe('convertData', () => {
	const rows: RowData[] = [
		{ name: 'Alice', age: 30, active: 'true', notes: '' },
		{ name: 'Bob', age: 25, active: 'false', notes: 'some note' }
	];

	it('converts with default string mappings', () => {
		const mappings = createDefaultMappings(['name', 'age']);
		const result = convertData(rows, mappings);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ name: 'Alice', age: '30' });
	});

	it('converts number type', () => {
		const mappings: MappingConfig[] = [
			{ source: 'age', target: 'age', type: 'number', excludeIfEmpty: false, defaultValue: '', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(result[0]).toEqual({ age: 30 });
	});

	it('converts boolean type', () => {
		const mappings: MappingConfig[] = [
			{ source: 'active', target: 'isActive', type: 'boolean', excludeIfEmpty: false, defaultValue: '', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(result[0]).toEqual({ isActive: true });
		expect(result[1]).toEqual({ isActive: false });
	});

	it('excludes empty fields when excludeIfEmpty is true', () => {
		const mappings: MappingConfig[] = [
			{ source: 'notes', target: 'notes', type: 'string', excludeIfEmpty: true, defaultValue: '', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(result[0]).toEqual({});
		expect(result[1]).toEqual({ notes: 'some note' });
	});

	it('uses default value for empty fields', () => {
		const mappings: MappingConfig[] = [
			{ source: 'notes', target: 'notes', type: 'string', excludeIfEmpty: false, defaultValue: 'N/A', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(result[0]).toEqual({ notes: 'N/A' });
	});

	it('returns null for empty fields with no default', () => {
		const mappings: MappingConfig[] = [
			{ source: 'notes', target: 'notes', type: 'string', excludeIfEmpty: false, defaultValue: '', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(result[0]).toEqual({ notes: null });
	});

	it('skips disabled columns', () => {
		const mappings: MappingConfig[] = [
			{ source: 'name', target: 'name', type: 'string', excludeIfEmpty: false, defaultValue: '', enabled: false },
			{ source: 'age', target: 'age', type: 'number', excludeIfEmpty: false, defaultValue: '', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(result[0]).toEqual({ age: 30 });
	});

	it('renames target keys', () => {
		const mappings: MappingConfig[] = [
			{ source: 'name', target: 'full_name', type: 'string', excludeIfEmpty: false, defaultValue: '', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(result[0]).toEqual({ full_name: 'Alice' });
	});
});

describe('date conversion', () => {
	it('formats Excel serial date numbers', () => {
		const rows: RowData[] = [{ date: 44927 }]; // 2023-01-01
		const mappings: MappingConfig[] = [
			{ source: 'date', target: 'date', type: 'date', format: 'YYYY-MM-DD', excludeIfEmpty: false, defaultValue: '', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(result[0].date).toBe('2023-01-01');
	});

	it('returns unix timestamp when format is timestamp', () => {
		const rows: RowData[] = [{ date: '2023-01-01' }];
		const mappings: MappingConfig[] = [
			{ source: 'date', target: 'date', type: 'date', format: 'timestamp', excludeIfEmpty: false, defaultValue: '', enabled: true }
		];
		const result = convertData(rows, mappings);
		expect(typeof result[0].date).toBe('number');
	});
});

describe('template system', () => {
	it('exports and applies templates', () => {
		const mappings = createDefaultMappings(['姓名', '入职日期']);
		mappings[0].target = 'userName';
		mappings[1].type = 'date';
		mappings[1].format = 'YYYY-MM-DD';
		mappings[1].target = 'joinDate';

		const template = exportTemplate(mappings);
		expect(template).toHaveLength(2);
		expect(template[0].target).toBe('userName');
		expect(template[1].format).toBe('YYYY-MM-DD');

		// Apply to fresh mappings
		const freshMappings = createDefaultMappings(['姓名', '入职日期', '备注']);
		const applied = applyTemplate(freshMappings, template);
		expect(applied[0].target).toBe('userName');
		expect(applied[1].type).toBe('date');
		expect(applied[2].target).toBe('备注'); // not in template, unchanged
	});
});
