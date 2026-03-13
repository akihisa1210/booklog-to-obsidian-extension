/**
 * Sync logic: CSV conversion, diff detection, Markdown generation.
 */

const FILENAME_MAX_BYTE_LENGTH = 200;
const INVALID_CHARS = /[\\/:*?"<>|\x00-\x1f[\]]/g;

/**
 * Convert a BooklogCSVRow to a Book object.
 */
function trimOrNull(value) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function convertRow(row) {
  const ratingStr = (row.rating ?? "").trim();
  const rating = /^\d+$/.test(ratingStr) ? parseInt(ratingStr, 10) : null;

  return {
    item_id: trimOrNull(row.item_id),
    title: trimOrNull(row.title),
    author: trimOrNull(row.author),
    isbn13: trimOrNull(row.isbn13),
    publisher: trimOrNull(row.publisher),
    publish_year: trimOrNull(row.publish_year),
    status: trimOrNull(row.status),
    rating,
  };
}

/**
 * Sanitize a filename for all OSes.
 */
export function sanitizeFilename(filename, maxBytes = 200) {
  let sanitized = filename.replace(INVALID_CHARS, "_");
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, "");

  if (!sanitized) {
    sanitized = "unnamed_book";
  }

  const encoder = new TextEncoder();
  const encoded = encoder.encode(sanitized);
  if (encoded.length > maxBytes) {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    sanitized = decoder.decode(encoded.slice(0, maxBytes));
    // Remove trailing replacement character from truncated multi-byte
    sanitized = sanitized.replace(/\uFFFD$/, "");
  }

  return sanitized;
}

/**
 * Generate a filename for a book.
 */
export function generateFilename(author, title, publisher, publishYear) {
  let filenameWithoutExt = `${author}『${title}』（${publisher}、${publishYear}）`;

  const encoder = new TextEncoder();
  const maxBytesWithoutExt = FILENAME_MAX_BYTE_LENGTH - 3; // ".md" = 3 bytes
  const encoded = encoder.encode(filenameWithoutExt);
  if (encoded.length > maxBytesWithoutExt) {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    filenameWithoutExt = decoder.decode(encoded.slice(0, maxBytesWithoutExt));
    filenameWithoutExt = filenameWithoutExt.replace(/\uFFFD$/, "");
  }

  const filename = `${filenameWithoutExt}.md`;
  return sanitizeFilename(filename);
}

/**
 * Compare existing frontmatter with a new Book and return differences.
 * Returns: { fieldName: [oldValue, newValue] }
 */
export function diffFrontmatter(existingProps, book) {
  const changes = {};
  for (const key of Object.keys(book)) {
    const oldVal = existingProps[key] ?? null;
    const newVal = book[key] ?? null;
    if (oldVal !== newVal) {
      changes[key] = [oldVal, newVal];
    }
  }
  return changes;
}

/**
 * Parse YAML frontmatter (flat, no nesting) into an object.
 * Handles: quoted strings, numbers, null, unquoted strings.
 */
export function parseFrontmatter(yamlStr) {
  const props = {};
  for (const line of yamlStr.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
    if (!match) continue;
    const [, key, rawValue] = match;
    props[key] = parseYamlValue(rawValue);
  }
  return props;
}

function parseYamlValue(raw) {
  const trimmed = raw.trim();

  if (trimmed === "" || trimmed === "null" || trimmed === "~") {
    return null;
  }

  // Single-quoted string
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  // Double-quoted string
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  // Integer
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Float
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Boolean
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Unquoted string
  return trimmed;
}

/**
 * Serialize a Book (or props object) to YAML frontmatter string.
 * Rules:
 * - Strings that look like numbers → single-quoted
 * - Integers → bare number
 * - null → null
 * - Other strings → unquoted
 */
export function serializeFrontmatter(props) {
  const lines = [];
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) {
      lines.push(`${key}: null`);
    } else if (typeof value === "number") {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else {
      const escaped = value.replace(/'/g, "''");
      lines.push(`${key}: '${escaped}'`);
    }
  }
  // trailing newline to match standard YAML output
  return lines.join("\n") + "\n";
}

/**
 * Split a Markdown file into frontmatter YAML string and body string.
 * Returns { yaml: string, body: string } or null if no frontmatter.
 */
export function splitMarkdown(content) {
  // Normalize CRLF to LF
  const normalized = content.replace(/\r\n/g, "\n");
  // Split on "---" that appears as its own line
  // First "---" must be at the start
  if (!normalized.startsWith("---\n")) return null;
  const rest = normalized.slice(4); // skip "---\n"
  // Find the next "---" on its own line
  const closeIndex = rest.search(/^---$/m);
  if (closeIndex === -1) return null;
  const yaml = rest.slice(0, closeIndex > 0 ? closeIndex - 1 : 0); // remove trailing \n before ---
  const body = rest.slice(closeIndex + 3); // skip "---"
  return { yaml, body };
}

/**
 * Build a Markdown string from frontmatter props and body.
 */
export function buildMarkdown(props, body) {
  const yaml = serializeFrontmatter(props);
  return `---\n${yaml}---\n${body}\n`;
}

/**
 * Build an index of item_id → filename from existing files via the Obsidian API.
 */
export async function buildIdBookIndex(api, booksDir) {
  const index = {};
  const files = await api.listFiles(booksDir);

  const mdFiles = files.filter((f) => f.endsWith(".md"));

  let readCount = 0;
  for (const filename of mdFiles) {
    const filePath = `${booksDir}/${filename}`;

    const content = await api.readFile(filePath);
    const match = content.match(/^item_id:\s*['"]?([A-Za-z0-9]+)['"]?/m);
    if (match) {
      index[match[1]] = filePath;
    }
    readCount++;
  }

  if (readCount > 0) {
    console.log(`buildIdBookIndex: read ${readCount} files`);
  }
  console.log("buildIdBookIndex: index", JSON.stringify(index));

  return index;
}

/**
 * Save a single book — create, update, or skip.
 * Returns: "created" | "updated" | "unchanged"
 */
export async function saveBook(api, booksDir, book, existingFile = null) {
  if (existingFile) {
    const oldContent = await api.readFile(existingFile);
    const parts = splitMarkdown(oldContent);

    if (!parts) {
      throw new Error(`Failed to parse frontmatter in existing file: ${existingFile}`);
    }

    const oldProps = parseFrontmatter(parts.yaml);

    const changes = diffFrontmatter(oldProps, book);

    if (Object.keys(changes).length === 0) {
      return "unchanged";
    }

    console.log("updated:", existingFile, JSON.stringify(changes));

    // Merge: keep existing keys, update with book data
    const mergedProps = { ...oldProps, ...book };
    const yaml = serializeFrontmatter(mergedProps);
    const content = `---\n${yaml}---${parts.body}`;
    await api.writeFile(existingFile, content);
    return "updated";
  }

  const filename = generateFilename(
    book.author,
    book.title,
    book.publisher,
    book.publish_year,
  );
  const filePath = `${booksDir}/${filename}`;
  console.log("created:", filePath);
  const content = buildMarkdown(book, "");
  await api.writeFile(filePath, content);
  return "created";
}

/**
 * Run full sync: compare books against existing index, create/update/skip.
 * Returns: { created, updated, unchanged }
 */
export async function runSync(api, booksDir, books, idBookIndex) {
  const result = { created: 0, updated: 0, unchanged: 0 };

  for (const book of books) {
    const existingFile = idBookIndex[book.item_id] ?? null;
    if (!existingFile) {
      console.log(`runSync: no match for item_id=${JSON.stringify(book.item_id)}, title=${book.title}`);
    }
    const status = await saveBook(api, booksDir, book, existingFile);
    result[status]++;
  }

  return result;
}
