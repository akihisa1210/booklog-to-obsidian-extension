import { describe, it, expect } from "vitest";
import { parseCSV, extractCSVUrl } from "../booklog.js";

describe("parseCSV", () => {
  it("parses basic CSV with 17 columns", () => {
    const csv =
      "1,1000000000,9784000000001,1-1,5,読み終わった,,tag1,メモ,2020-01-01,2020-02-01,テストタイトル,テスト作者名,テスト出版社,2020,文庫,200\n";
    const rows = parseCSV(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0].service_id).toBe("1");
    expect(rows[0].item_id).toBe("1000000000");
    expect(rows[0].isbn13).toBe("9784000000001");
    expect(rows[0].category).toBe("1-1");
    expect(rows[0].rating).toBe("5");
    expect(rows[0].status).toBe("読み終わった");
    expect(rows[0].title).toBe("テストタイトル");
    expect(rows[0].author).toBe("テスト作者名");
    expect(rows[0].publisher).toBe("テスト出版社");
    expect(rows[0].publish_year).toBe("2020");
    expect(rows[0].book_type).toBe("文庫");
    expect(rows[0].page_count).toBe("200");
  });

  it("handles quoted fields containing commas", () => {
    const csv = '1,1000000000,978,,5,読了,"面白い、とても",,,,,,"著者A, 著者B",出版社,2020,文庫,100\n';
    const rows = parseCSV(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0].review).toBe("面白い、とても");
  });

  it("handles empty fields as empty strings", () => {
    const csv = "1,1000000000,978,,,読了,,,,,,タイトル,著者,出版社,2020,,\n";
    const rows = parseCSV(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe("");
    expect(rows[0].review).toBe("");
    expect(rows[0].tags).toBe("");
  });

  it("parses multiple rows", () => {
    const csv =
      "1,100,978,,5,読了,,,,,,タイトル1,著者1,出版社1,2020,,\n" +
      "1,200,978,,3,積読,,,,,,タイトル2,著者2,出版社2,2021,,\n";
    const rows = parseCSV(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0].item_id).toBe("100");
    expect(rows[1].item_id).toBe("200");
  });
});

describe("extractCSVUrl", () => {
  it("extracts CSV download link from HTML", () => {
    const html = `
      <html>
      <body>
        <a href="https://download.booklog.jp/shelf/csv?signature=abc123">CSVエクスポート</a>
      </body>
      </html>
    `;
    const url = extractCSVUrl(html);
    expect(url).toBe(
      "https://download.booklog.jp/shelf/csv?signature=abc123",
    );
  });

  it("returns null when no link found", () => {
    const html = "<html><body>No link here</body></html>";
    expect(extractCSVUrl(html)).toBeNull();
  });
});
