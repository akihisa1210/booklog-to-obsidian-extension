import { describe, it, expect, vi } from "vitest";
import { createBook, createBooklogCSVRow } from "./helpers.js";
import {
  convertRow,
  sanitizeFilename,
  generateFilename,
  diffFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
  splitMarkdown,
  buildMarkdown,
  buildIdBookIndex,
  saveBook,
  runSync,
} from "../sync.js";

// --- Phase 1: Pure functions ---

describe("convertRow", () => {
  it("converts a CSV row to Book with rating as number", () => {
    const row = createBooklogCSVRow();
    const book = convertRow(row);

    expect(book.item_id).toBe("1000000000");
    expect(book.title).toBe("テストタイトル");
    expect(book.author).toBe("テスト作者名");
    expect(book.isbn13).toBe("9784000000001");
    expect(book.publisher).toBe("テスト出版社");
    expect(book.publish_year).toBe("2020");
    expect(book.status).toBe("読み終わった");
    expect(book.rating).toBe(5);
  });

  it("converts empty rating to null", () => {
    const row = createBooklogCSVRow({ rating: "" });
    const book = convertRow(row);

    expect(book.rating).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it("replaces forbidden characters with underscore and trims", () => {
    expect(sanitizeFilename(" /a ")).toBe("_a");
  });

  it("replaces brackets", () => {
    expect(sanitizeFilename("test[1].md")).toBe("test_1_.md");
  });

  it("returns unnamed_book for empty result", () => {
    expect(sanitizeFilename("...")).toBe("unnamed_book");
  });
});

describe("generateFilename", () => {
  it("generates correct filename", () => {
    const name = generateFilename(
      "テスト作者名",
      "テストタイトル",
      "テスト出版社",
      "2020",
    );
    expect(name).toBe("テスト作者名『テストタイトル』（テスト出版社、2020）.md");
  });

  it("does not truncate when just under 200 bytes", () => {
    // 175 'a' + 『a』（a、2020）.md = 199 bytes, no truncation needed
    const longAuthor = "a".repeat(175);
    const name = generateFilename(longAuthor, "a", "a", "2020");
    const byteLength = new TextEncoder().encode(name).length;
    expect(byteLength).toBe(199);
    expect(name).toBe(
      `${"a".repeat(175)}『a』（a、2020）.md`,
    );
  });

  it("truncates when over 200 bytes", () => {
    // 176 'a' + 『a』（a、2020）.md = 200 bytes for the body + 3 for .md
    // body = 176 + 24 = 200, total = 203 → truncated
    const longAuthor = "a".repeat(176);
    const name = generateFilename(longAuthor, "a", "a", "2020");
    const byteLength = new TextEncoder().encode(name).length;
    expect(byteLength).toBeLessThanOrEqual(200);
  });
});

describe("diffFrontmatter", () => {
  it("returns empty object when no changes", () => {
    const book = createBook();
    const existing = {
      item_id: "1000000000",
      title: "テストタイトル",
      author: "テスト作者名",
      isbn13: "9784000000001",
      publisher: "テスト出版社",
      publish_year: "2020",
      status: "読み終わった",
      rating: 5,
    };
    expect(diffFrontmatter(existing, book)).toEqual({});
  });

  it("detects rating change", () => {
    const book = createBook({ rating: 3 });
    const existing = {
      item_id: "1000000000",
      title: "テストタイトル",
      author: "テスト作者名",
      isbn13: "9784000000001",
      publisher: "テスト出版社",
      publish_year: "2020",
      status: "読み終わった",
      rating: 5,
    };
    expect(diffFrontmatter(existing, book)).toEqual({
      rating: [5, 3],
    });
  });

  it("detects multiple changes", () => {
    const book = createBook({
      rating: 3,
      status: "積読",
      title: "新タイトル",
    });
    const existing = {
      item_id: "1000000000",
      title: "テストタイトル",
      author: "テスト作者名",
      isbn13: "9784000000001",
      publisher: "テスト出版社",
      publish_year: "2020",
      status: "読み終わった",
      rating: 5,
    };
    expect(diffFrontmatter(existing, book)).toEqual({
      title: ["テストタイトル", "新タイトル"],
      status: ["読み終わった", "積読"],
      rating: [5, 3],
    });
  });

  it("detects null to int change", () => {
    const book = createBook({ rating: 5 });
    const existing = {
      item_id: "1000000000",
      title: "テストタイトル",
      author: "テスト作者名",
      isbn13: "9784000000001",
      publisher: "テスト出版社",
      publish_year: "2020",
      status: "読み終わった",
      rating: null,
    };
    expect(diffFrontmatter(existing, book)).toEqual({
      rating: [null, 5],
    });
  });

  it("detects int to null change", () => {
    const book = createBook({ rating: null });
    const existing = {
      item_id: "1000000000",
      title: "テストタイトル",
      author: "テスト作者名",
      isbn13: "9784000000001",
      publisher: "テスト出版社",
      publish_year: "2020",
      status: "読み終わった",
      rating: 5,
    };
    expect(diffFrontmatter(existing, book)).toEqual({
      rating: [5, null],
    });
  });
});

describe("parseFrontmatter", () => {
  it("parses YAML frontmatter correctly", () => {
    const yaml = `item_id: '1000000000'
title: テストタイトル
author: テスト作者名
isbn13: '9784000000001'
publisher: テスト出版社
publish_year: '2020'
status: 読み終わった
rating: 5`;
    const props = parseFrontmatter(yaml);
    expect(props.item_id).toBe("1000000000");
    expect(props.title).toBe("テストタイトル");
    expect(props.isbn13).toBe("9784000000001");
    expect(props.publish_year).toBe("2020");
    expect(props.rating).toBe(5);
  });

  it("parses null values", () => {
    const yaml = `rating: null`;
    expect(parseFrontmatter(yaml).rating).toBeNull();
  });

  it("parses empty value as null", () => {
    const yaml = `rating:`;
    expect(parseFrontmatter(yaml).rating).toBeNull();
  });
});

describe("serializeFrontmatter", () => {
  it("serializes Book to YAML matching Python yaml.dump output", () => {
    const book = createBook();
    const yaml = serializeFrontmatter(book);
    expect(yaml).toBe(
      `item_id: '1000000000'
title: テストタイトル
author: テスト作者名
isbn13: '9784000000001'
publisher: テスト出版社
publish_year: '2020'
status: 読み終わった
rating: 5
`,
    );
  });

  it("serializes null rating", () => {
    const book = createBook({ rating: null });
    const yaml = serializeFrontmatter(book);
    expect(yaml).toContain("rating: null");
  });
});

describe("splitMarkdown", () => {
  it("splits frontmatter and body", () => {
    const content = `---
item_id: '1000000000'
title: テストタイトル
---
## メモ
面白かった`;
    const result = splitMarkdown(content);
    expect(result).not.toBeNull();
    expect(result.yaml).toContain("item_id: '1000000000'");
    expect(result.body).toContain("## メモ");
    expect(result.body).toContain("面白かった");
  });

  it("handles triple dash in title without breaking", () => {
    const content = `---
item_id: '1000000000'
title: タイトル---サブタイトル
---
## メモ`;
    const result = splitMarkdown(content);
    expect(result).not.toBeNull();
    expect(result.yaml).toContain("title: タイトル---サブタイトル");
  });

  it("returns null for content without frontmatter", () => {
    expect(splitMarkdown("# Just a heading")).toBeNull();
  });
});

describe("buildMarkdown", () => {
  it("builds correct markdown with frontmatter and body", () => {
    const book = createBook();
    const md = buildMarkdown(book, "# 感想\n面白かった");
    expect(md).toBe(`---
item_id: '1000000000'
title: テストタイトル
author: テスト作者名
isbn13: '9784000000001'
publisher: テスト出版社
publish_year: '2020'
status: 読み終わった
rating: 5
---
# 感想
面白かった
`);
  });
});

// --- Phase 4: Async functions with mocked API ---

/**
 * Create a mock API.
 * `files` is keyed by full path (e.g. "Books/Book1.md").
 * `listFiles` returns filenames only (no directory prefix), matching the real API.
 */
function createMockApi(files = {}) {
  return {
    listFiles: vi.fn().mockImplementation((dir) => {
      const prefix = dir + "/";
      const filenames = Object.keys(files)
        .filter((p) => p.startsWith(prefix))
        .map((p) => p.slice(prefix.length));
      return Promise.resolve(filenames);
    }),
    readFile: vi.fn().mockImplementation((path) => {
      if (files[path] !== undefined) return Promise.resolve(files[path]);
      return Promise.reject(new Error(`File not found: ${path}`));
    }),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
}

describe("buildIdBookIndex", () => {
  it("builds index from files with item_id", async () => {
    const api = createMockApi({
      "Books/Book1.md": "---\nitem_id: 1000000000\n---",
      "Books/Note.md": "# メモ\nitem_idなし",
    });

    const { index } = await buildIdBookIndex(api, "Books");
    expect(index["1000000000"]).toBe("Books/Book1.md");
    expect(Object.keys(index)).toHaveLength(1);
  });

  it("handles alphanumeric item_id", async () => {
    const api = createMockApi({
      "Books/Book1.md": "---\ntags:\nitem_id: B0D143YRBP\n---",
      "Books/Note.md": "# メモ\nitem_idなし",
    });

    const { index } = await buildIdBookIndex(api, "Books");
    expect(index["B0D143YRBP"]).toBe("Books/Book1.md");
    expect(Object.keys(index)).toHaveLength(1);
  });

  it("returns empty index when directory does not exist", async () => {
    const api = {
      listFiles: vi.fn().mockRejectedValue(new Error("Not found")),
      readFile: vi.fn(),
      writeFile: vi.fn(),
    };

    const { index } = await buildIdBookIndex(api, "Books");
    expect(index).toEqual({});
  });

  it("uses cache to skip reading known files", async () => {
    const api = createMockApi({
      "Books/Book1.md": "---\nitem_id: 1000000000\n---",
      "Books/Book2.md": "---\nitem_id: 2000000000\n---",
    });
    const cache = { "Book1.md": "1000000000" };

    const { index } = await buildIdBookIndex(api, "Books", cache);
    expect(index["1000000000"]).toBe("Books/Book1.md");
    expect(index["2000000000"]).toBe("Books/Book2.md");
    // Only Book2.md should be read (Book1.md is cached)
    expect(api.readFile).toHaveBeenCalledTimes(1);
    expect(api.readFile).toHaveBeenCalledWith("Books/Book2.md");
  });

  it("removes deleted files from cache", async () => {
    const api = createMockApi({
      "Books/Book1.md": "---\nitem_id: 1000000000\n---",
    });
    const cache = { "Book1.md": "1000000000", "Deleted.md": "9999999999" };

    const { index, cache: newCache } = await buildIdBookIndex(api, "Books", cache);
    expect(index["1000000000"]).toBe("Books/Book1.md");
    expect(index["9999999999"]).toBeUndefined();
    expect(newCache["Deleted.md"]).toBeUndefined();
  });
});

describe("saveBook", () => {
  it("creates new file when no existing file", async () => {
    const api = createMockApi({});
    const book = createBook();

    const result = await saveBook(api, "Books", book);

    expect(result).toBe("created");
    expect(api.writeFile).toHaveBeenCalledOnce();
    const [path, content] = api.writeFile.mock.calls[0];
    expect(path).toBe(
      "Books/テスト作者名『テストタイトル』（テスト出版社、2020）.md",
    );
    expect(content).toContain("item_id: '1000000000'");
  });

  it("returns unchanged when frontmatter has no diff", async () => {
    const existingContent = `---
item_id: '1000000000'
title: テストタイトル
author: テスト作者名
isbn13: '9784000000001'
publisher: テスト出版社
publish_year: '2020'
status: 読み終わった
rating: 5
---
## メモ
面白かった`;
    const api = createMockApi({
      "Books/Existing.md": existingContent,
    });
    const book = createBook();

    const result = await saveBook(api, "Books", book, "Books/Existing.md");

    expect(result).toBe("unchanged");
    expect(api.writeFile).not.toHaveBeenCalled();
  });

  it("updates when frontmatter has diff and preserves body", async () => {
    const existingContent = `---
item_id: '1000000000'
title: テストタイトル
author: テスト作者名
isbn13: '9784000000001'
publisher: テスト出版社
publish_year: '2020'
status: 読み終わった
rating: 5
---
## メモ
面白かった`;
    const api = createMockApi({
      "Books/Existing.md": existingContent,
    });
    const book = createBook({ rating: 3 });

    const result = await saveBook(api, "Books", book, "Books/Existing.md");

    expect(result).toBe("updated");
    expect(api.writeFile).toHaveBeenCalledOnce();
    const [, content] = api.writeFile.mock.calls[0];
    expect(content).toContain("rating: 3");
    expect(content).toContain("## メモ");
    expect(content).toContain("面白かった");
  });

  it("overwrites on YAML parse error but preserves body", async () => {
    const existingContent = `---
item_id: '1000000000'
title: [invalid yaml
---
## メモ`;
    const api = createMockApi({
      "Books/Broken.md": existingContent,
    });
    const book = createBook();

    const result = await saveBook(api, "Books", book, "Books/Broken.md");

    expect(result).toBe("updated");
    const [, content] = api.writeFile.mock.calls[0];
    expect(content).toContain("title: テストタイトル");
    expect(content).toContain("## メモ");
  });

  it("does not add extra newlines on repeated updates", async () => {
    const existingContent = `---
item_id: '1000000000'
title: テストタイトル
author: テスト作者名
isbn13: '9784000000001'
publisher: テスト出版社
publish_year: '2020'
status: 積読
rating: 5
---
## メモ
面白かった`;
    const api = createMockApi({
      "Books/Existing.md": existingContent,
    });

    // First update
    const book1 = createBook({ status: "読み終わった" });
    await saveBook(api, "Books", book1, "Books/Existing.md");
    const content1 = api.writeFile.mock.calls[0][1];

    // Simulate second update using the output of the first
    api.readFile.mockResolvedValue(content1);
    api.writeFile.mockClear();
    const book2 = createBook({ status: "積読" });
    await saveBook(api, "Books", book2, "Books/Existing.md");
    const content2 = api.writeFile.mock.calls[0][1];

    // No extra newlines between frontmatter and body
    const dashCount1 = (content1.match(/\n---\n/g) || []).length;
    const dashCount2 = (content2.match(/\n---\n/g) || []).length;
    expect(dashCount1).toBe(1);
    expect(dashCount2).toBe(1);
  });
});

describe("runSync", () => {
  it("returns correct counts for create/update/unchanged", async () => {
    const existingContent = `---
item_id: '2000000000'
title: 既存本
author: 著者
isbn13: '9784000000002'
publisher: 出版社
publish_year: '2021'
status: 積読
rating: 3
---
`;
    const api = createMockApi({
      "Books/Existing.md": existingContent,
    });

    const books = [
      createBook(), // new book → created
      createBook({
        item_id: "2000000000",
        title: "既存本",
        author: "著者",
        isbn13: "9784000000002",
        publisher: "出版社",
        publish_year: "2021",
        status: "読み終わった",
        rating: 3,
      }), // existing, changed status → updated
    ];
    const idBookIndex = { "2000000000": "Books/Existing.md" };

    const result = await runSync(api, "Books", books, idBookIndex);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(0);
  });
});
