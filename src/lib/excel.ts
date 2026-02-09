import * as XLSX from 'xlsx';
import type { RowData } from './types.js';

export interface ParsedExcel {
	headers: string[];
	rows: RowData[];
	sheetNames: string[];
}

/**
 * Parse an Excel/CSV file into headers and rows.
 */
export async function parseExcelFile(file: File): Promise<ParsedExcel> {
	const buffer = await file.arrayBuffer();
	const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
	const sheetNames = workbook.SheetNames;

	if (sheetNames.length === 0) {
		throw new Error('文件中没有找到任何工作表');
	}

	return parseSheet(workbook, sheetNames[0]);
}

/**
 * Parse a specific sheet from a workbook.
 */
export function parseSheet(workbook: XLSX.WorkBook, sheetName: string): ParsedExcel {
	const sheet = workbook.Sheets[sheetName];
	if (!sheet) {
		throw new Error(`工作表 "${sheetName}" 不存在`);
	}

	const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		defval: ''
	});

	if (jsonData.length === 0) {
		throw new Error('工作表中没有数据');
	}

	const allHeaders = Object.keys(jsonData[0]);
	// Filter out SheetJS placeholder headers for empty columns (__EMPTY, __EMPTY_1, etc.)
	const headers = allHeaders.filter((h) => !/^__EMPTY(_\d+)?$/.test(h));

	// Strip empty-column keys from rows
	const rows = headers.length < allHeaders.length
		? jsonData.map((row) => {
				const cleaned: Record<string, unknown> = {};
				for (const h of headers) cleaned[h] = row[h];
				return cleaned;
			})
		: jsonData;

	return { headers, rows, sheetNames: workbook.SheetNames };
}
