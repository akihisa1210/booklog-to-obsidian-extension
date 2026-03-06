import { fetchExportPageUrl, fetchAndParseCSV } from "./lib/booklog.js";
import { ObsidianAPI } from "./lib/obsidian-api.js";
import { convertRow, buildIdBookIndex, runSync } from "./lib/sync.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "sync") {
    handleSync(message.config)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep message channel open for async response
  }
});

function sendProgress(text) {
  chrome.runtime.sendMessage({ type: "progress", text }).catch(() => {});
}

async function handleSync(config) {
  const { apiKey, protocol, port, booksDir } = config;

  // 1. Fetch CSV from booklog
  sendProgress("ブクログからCSVを取得中...");
  const csvUrl = await fetchExportPageUrl();
  if (!csvUrl) {
    throw new Error(
      "CSVダウンロードURLが見つかりませんでした。ブクログにログインしていることを確認してください。",
    );
  }

  sendProgress("CSVをダウンロード中...");
  const rows = await fetchAndParseCSV(csvUrl);
  const books = rows.map(convertRow);

  // 2. Build index from existing Obsidian files (with cache)
  sendProgress("Obsidianのファイル一覧を取得中...");
  const api = new ObsidianAPI({ apiKey, port, protocol });
  const stored = await chrome.storage.local.get("indexCache");
  const oldCache = stored.indexCache || {};
  const { index: idBookIndex, cache: newCache } = await buildIdBookIndex(api, booksDir, oldCache);
  await chrome.storage.local.set({ indexCache: newCache });

  // 3. Sync
  sendProgress(`${books.length}冊を同期中...`);
  const result = await runSync(api, booksDir, books, idBookIndex);
  return result;
}
