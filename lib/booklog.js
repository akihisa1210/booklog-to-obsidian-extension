/**
 * Booklog CSV fetch and parse — Chrome extension context.
 */

const BOOKLOG_CSV_COLUMNS = [
  "service_id",
  "item_id",
  "isbn13",
  "category",
  "rating",
  "status",
  "review",
  "tags",
  "memo",
  "registered_at",
  "finished_at",
  "title",
  "author",
  "publisher",
  "publish_year",
  "book_type",
  "page_count",
];

/**
 * Parse a CSV string into an array of row objects.
 * Handles quoted fields containing commas and newlines.
 */
export function parseCSV(csvText) {
  const rows = [];
  let i = 0;

  while (i < csvText.length) {
    const { fields, nextIndex } = parseLine(csvText, i);
    i = nextIndex;
    if (fields.length > 0) {
      const row = {};
      for (let j = 0; j < BOOKLOG_CSV_COLUMNS.length && j < fields.length; j++) {
        row[BOOKLOG_CSV_COLUMNS[j]] = fields[j];
      }
      rows.push(row);
    }
  }

  return rows;
}

function parseLine(text, start) {
  const fields = [];
  let i = start;

  while (i < text.length) {
    if (text[i] === "\n" || text[i] === "\r") {
      // End of line
      if (text[i] === "\r" && text[i + 1] === "\n") i++;
      i++;
      break;
    }

    if (text[i] === '"') {
      // Quoted field
      let value = "";
      i++; // skip opening quote
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += text[i];
          i++;
        }
      }
      fields.push(value);
      // Skip comma after field
      if (text[i] === ",") i++;
    } else {
      // Unquoted field
      let value = "";
      while (i < text.length && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
        value += text[i];
        i++;
      }
      fields.push(value);
      if (text[i] === ",") i++;
    }
  }

  return { fields, nextIndex: i };
}

/**
 * Extract the CSV download URL from the booklog export page HTML.
 */
export function extractCSVUrl(html) {
  const match = html.match(/href="(https:\/\/download\.booklog\.jp\/[^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Fetch the export page and extract the CSV download URL.
 * Uses the browser's authenticated session.
 */
export async function fetchExportPageUrl() {
  const response = await fetch("https://booklog.jp/export", {
    credentials: "include",
  });
  const html = await response.text();
  return extractCSVUrl(html);
}

/**
 * Fetch and parse CSV from the given URL.
 * Decodes from Shift_JIS (cp932).
 */
export async function fetchAndParseCSV(url) {
  const response = await fetch(url, { credentials: "include" });
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("shift_jis");
  const csvText = decoder.decode(buffer);
  return parseCSV(csvText);
}
