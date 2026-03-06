# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome extension (Manifest V3) that syncs books from booklog.jp to an Obsidian vault via the Obsidian Local REST API plugin. Uses the browser's authenticated session to fetch CSV data from booklog, then creates/updates Markdown files with YAML frontmatter.

## Commands

- Run all tests: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Run a single test file: `npx vitest run lib/__tests__/sync.test.js`

## Architecture

No build step. Vanilla JS with ES Modules, loaded directly by Chrome.

**Data flow:** Popup → `background.js` (Service Worker) → `lib/` modules → Obsidian API

- `background.js` — Service Worker. Listens for "sync" messages from popup, orchestrates the pipeline, sends progress updates back.
- `popup.js` / `popup.html` — Settings UI (API key, protocol, port, books directory) stored in `chrome.storage.local`. Sync button and status display.
- `lib/booklog.js` — Fetches booklog.jp export page, extracts CSV download URL, parses CSV (cp932/Shift_JIS). CSV has 17 fixed columns mapped to named fields.
- `lib/obsidian-api.js` — `ObsidianAPI` class wrapping `listFiles`/`readFile`/`writeFile` against the Local REST API. Paths are encoded per-segment with `encodeURIComponent`. Supports HTTP and HTTPS.
- `lib/sync.js` — Core logic:
  - `convertRow()` — CSV row to Book object. Empty strings become `null`, values are trimmed.
  - `generateFilename()` / `sanitizeFilename()` — `{author}『{title}』（{publisher}、{publish_year}）.md` with 200-byte UTF-8 limit.
  - `parseFrontmatter()` / `serializeFrontmatter()` — Flat YAML (no nesting, no library). Numeric-looking strings are single-quoted, integers bare, null as `null`.
  - `splitMarkdown()` / `buildMarkdown()` — Split/join frontmatter and body. Handles `---` inside YAML values.
  - `buildIdBookIndex()` — Builds `item_id → filepath` mapping from vault files. Uses a `filename → item_id` cache (stored in `chrome.storage.local`) to skip reading unchanged files.
  - `saveBook()` — Creates, updates (if frontmatter differs), or skips a single book. Preserves body on update.
  - `diffFrontmatter()` — Compares only Book keys, returns `{ field: [old, new] }`.

## Testing

Vitest with explicit imports (not globals). Test helpers in `lib/__tests__/helpers.js` provide `createBook()` and `createBooklogCSVRow()` factory functions.

`ObsidianAPI` is mocked in tests via `createMockApi()` which simulates `listFiles` returning filenames only (no directory prefix), matching real API behavior.

## Key Design Decisions

- **`listFiles` returns filenames only** (not full paths). `buildIdBookIndex` prepends `booksDir/` when calling `readFile`.
- **Frontmatter is parsed/serialized without a YAML library** because the format is flat key-value only.
- **Index cache** in `chrome.storage.local` avoids re-reading all vault files on every sync. Cache is keyed by filename, invalidated when files disappear from `listFiles`.
- **Obsidian Local REST API uses self-signed certs** on HTTPS, which Chrome extensions cannot bypass. Default config uses HTTP (port 27123) instead.
