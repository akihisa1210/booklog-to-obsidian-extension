import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObsidianAPI } from "../obsidian-api.js";

describe("ObsidianAPI", () => {
  let api;
  let mockFetch;

  beforeEach(() => {
    api = new ObsidianAPI({ apiKey: "test-key", port: 27124 });
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  it("listFiles sends correct request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: ["Books/a.md", "Books/b.md"] }),
    });

    const files = await api.listFiles("Books");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://127.0.0.1:27124/vault/Books/",
      {
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
      },
    );
    expect(files).toEqual(["Books/a.md", "Books/b.md"]);
  });

  it("readFile sends correct request and returns text", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("---\ntitle: Test\n---"),
    });

    const content = await api.readFile("Books/test.md");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://127.0.0.1:27124/vault/Books/test.md",
      {
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
      },
    );
    expect(content).toBe("---\ntitle: Test\n---");
  });

  it("writeFile sends PUT with correct body", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const content = "---\ntitle: Test\n---\n";
    await api.writeFile("Books/test.md", content);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://127.0.0.1:27124/vault/Books/test.md",
      {
        method: "PUT",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "text/markdown",
        },
        body: content,
      },
    );
  });

  it("includes Authorization header with API key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    });

    await api.listFiles("Books");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer test-key");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(api.listFiles("Books")).rejects.toThrow("listFiles failed: 404");
  });
});
