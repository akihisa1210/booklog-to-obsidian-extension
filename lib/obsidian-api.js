/**
 * Obsidian Local REST API client.
 */

export class ObsidianAPI {
  constructor({ apiKey, port = 27124, protocol = "https" }) {
    this.apiKey = apiKey;
    this.port = port;
    this.baseUrl = `${protocol}://127.0.0.1:${port}`;
  }

  _encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  _headers(contentType = null) {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    return headers;
  }

  /**
   * List files in a directory.
   * Returns an array of file paths (strings).
   */
  async listFiles(dir) {
    const response = await fetch(`${this.baseUrl}/vault/${this._encodePath(dir)}/`, {
      headers: this._headers("application/json"),
    });
    if (!response.ok) {
      throw new Error(`listFiles failed: ${response.status}`);
    }
    const data = await response.json();
    return data.files || [];
  }

  /**
   * Read a file's content as text.
   */
  async readFile(path) {
    const response = await fetch(`${this.baseUrl}/vault/${this._encodePath(path)}`, {
      headers: this._headers("application/json"),
    });
    if (!response.ok) {
      throw new Error(`readFile failed: ${response.status}`);
    }
    return response.text();
  }

  /**
   * Write (create or overwrite) a file.
   */
  async writeFile(path, content) {
    const response = await fetch(`${this.baseUrl}/vault/${this._encodePath(path)}`, {
      method: "PUT",
      headers: this._headers("text/markdown"),
      body: content,
    });
    if (!response.ok) {
      throw new Error(`writeFile failed: ${response.status}`);
    }
  }
}
