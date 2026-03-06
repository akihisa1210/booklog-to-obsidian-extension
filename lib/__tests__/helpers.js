/**
 * Test helpers for creating test data.
 */

export function createBooklogCSVRow(props = {}) {
  return {
    item_id: "1000000000",
    title: "テストタイトル",
    author: "テスト作者名",
    isbn13: "9784000000001",
    publisher: "テスト出版社",
    publish_year: "2020",
    status: "読み終わった",
    rating: "5",
    ...props,
  };
}

export function createBook(props = {}) {
  return {
    item_id: "1000000000",
    title: "テストタイトル",
    author: "テスト作者名",
    isbn13: "9784000000001",
    publisher: "テスト出版社",
    publish_year: "2020",
    status: "読み終わった",
    rating: 5,
    ...props,
  };
}
