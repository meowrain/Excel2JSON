# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**excel2json** — a SvelteKit web application for converting Excel files to JSON with visual mapping configuration. Built with Svelte 5, SvelteKit 2, TypeScript, and Tailwind CSS 4.

## Commands

- `npm run dev` — start dev server (typically http://localhost:5173)
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run check` — type-check with svelte-check
- `npm run check:watch` — type-check in watch mode
- `npm run test` — run all tests once
- `npm run test:unit` — run tests in watch mode
- `npm run test:unit -- --run --testNamePattern="pattern"` — run a single test by name

## Architecture

- **Framework**: SvelteKit 2 with Svelte 5 (runes API: `$state`, `$props`, `$derived`, etc.)
- **Styling**: Tailwind CSS 4 with `@tailwindcss/forms` and `@tailwindcss/typography` plugins, configured via `src/routes/layout.css`
- **Adapter**: `@sveltejs/adapter-auto`
- **TypeScript**: strict mode enabled
- **Dependencies**: `xlsx` (SheetJS) for Excel parsing, `dayjs` for date handling

### Testing

Two Vitest project configurations in `vitest.config.ts`:

- **`client`** — browser tests using Playwright (headless Chromium). Files matching `src/**/*.svelte.{test,spec}.{js,ts}`. Uses `vitest-browser-svelte` for component rendering.
- **`server`** — Node.js unit tests. Files matching `src/**/*.{test,spec}.{js,ts}` (excluding `.svelte.` test files).

All tests require assertions (`expect.requireAssertions: true`).

### Key Conventions

- Svelte components use `lang="ts"` in script tags
- Shared library code goes in `src/lib/` (aliased as `$lib`)
- Use Svelte 5 runes syntax, not legacy Svelte 4 patterns

### Core Application Structure

**Single-page application** with split-pane layout:

- `src/routes/+page.svelte` — Main page containing all application logic
- `src/lib/components/ExcelTable.svelte` — Left panel showing Excel data with column configuration
- `src/lib/components/JsonPreview.svelte` — Right panel showing JSON output with syntax highlighting
- `src/lib/components/ColumnConfig.svelte` — Modal for column mapping configuration
- `src/lib/components/ApiConfigModal.svelte` — API enrichment rules configuration
- `src/lib/components/SubmissionSettings.svelte` — Data submission settings

**Core libraries:**

- `src/lib/excel.ts` — Excel/CSV reading and parsing
- `src/lib/converter.ts` — Mapping conversion core logic
- `src/lib/types.ts` — TypeScript type definitions (`MappingConfig`, `RowData`, etc.)

**Data flow:** File upload → Excel parsing → Mapping configuration → JSON conversion → Preview/Export

**Key features:**
- Nested object support via dot notation (e.g., `user.address.city`)
- Date formatting including Excel serial date compatibility
- Empty value handling (exclude field or use default value)
- Template import/export for mapping configurations
- API enrichment for dynamic data fetching

## Svelte MCP Server

A Svelte MCP server is available for Svelte 5 / SvelteKit documentation lookup and code validation. When writing Svelte code:

1. Use `list-sections` first to discover relevant documentation
2. Use `get-documentation` to fetch needed sections
3. Use `svelte-autofixer` to validate Svelte code before finalizing — keep calling until no issues remain
4. Offer `playground-link` only if code was NOT written to project files
