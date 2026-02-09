# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**excel2json** — a SvelteKit web application for converting Excel files to JSON. Built with Svelte 5, SvelteKit 2, TypeScript, and Tailwind CSS 4.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run check` — type-check with svelte-check
- `npm run test` — run all tests once
- `npm run test:unit` — run tests in watch mode
- `npm run test:unit -- --run --testNamePattern="pattern"` — run a single test by name

## Architecture

- **Framework**: SvelteKit 2 with Svelte 5 (runes API: `$state`, `$props`, `$derived`, etc.)
- **Styling**: Tailwind CSS 4 with `@tailwindcss/forms` and `@tailwindcss/typography` plugins, configured via `src/routes/layout.css`
- **Adapter**: `@sveltejs/adapter-auto`
- **TypeScript**: strict mode enabled

### Testing

Two Vitest project configurations in `vite.config.ts`:

- **`client`** — browser tests using Playwright (headless Chromium). Files matching `src/**/*.svelte.{test,spec}.{js,ts}`. Uses `vitest-browser-svelte` for component rendering.
- **`server`** — Node.js unit tests. Files matching `src/**/*.{test,spec}.{js,ts}` (excluding `.svelte.` test files).

All tests require assertions (`expect.requireAssertions: true`).

### Key Conventions

- Svelte components use `lang="ts"` in script tags
- Shared library code goes in `src/lib/` (aliased as `$lib`)
- Use Svelte 5 runes syntax, not legacy Svelte 4 patterns

## Svelte MCP Server

A Svelte MCP server is available for Svelte 5 / SvelteKit documentation lookup and code validation. When writing Svelte code:

1. Use `list-sections` first to discover relevant documentation
2. Use `get-documentation` to fetch needed sections
3. Use `svelte-autofixer` to validate Svelte code before finalizing — keep calling until no issues remain
4. Offer `playground-link` only if code was NOT written to project files
