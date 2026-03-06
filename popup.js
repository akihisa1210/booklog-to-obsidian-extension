const apiKeyInput = document.getElementById("api-key");
const protocolSelect = document.getElementById("protocol");
const portInput = document.getElementById("port");
const booksDirInput = document.getElementById("books-dir");
const saveBtn = document.getElementById("save-btn");
const syncBtn = document.getElementById("sync-btn");
const statusDiv = document.getElementById("status");

// Load saved settings
chrome.storage.local.get(["apiKey", "protocol", "port", "booksDir"], (data) => {
  if (data.apiKey) apiKeyInput.value = data.apiKey;
  if (data.protocol) protocolSelect.value = data.protocol;
  if (data.port) portInput.value = data.port;
  if (data.booksDir) booksDirInput.value = data.booksDir;
});

// Save settings
document.getElementById("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const settings = {
    apiKey: apiKeyInput.value,
    protocol: protocolSelect.value,
    port: parseInt(portInput.value, 10) || 27123,
    booksDir: booksDirInput.value,
  };
  chrome.storage.local.set(settings, () => {
    statusDiv.textContent = "Settings saved.";
    statusDiv.className = "";
  });
});

// Listen for progress messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "progress") {
    statusDiv.textContent = message.text;
    statusDiv.className = "";
  }
});

// Sync
syncBtn.addEventListener("click", () => {
  syncBtn.disabled = true;
  statusDiv.textContent = "Syncing...";
  statusDiv.className = "";

  chrome.storage.local.get(["apiKey", "protocol", "port", "booksDir"], (data) => {
    if (!data.apiKey || !data.booksDir) {
      statusDiv.textContent = "Please configure settings first.";
      statusDiv.className = "error";
      syncBtn.disabled = false;
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "sync",
        config: {
          apiKey: data.apiKey,
          protocol: data.protocol || "http",
          port: data.port || 27123,
          booksDir: data.booksDir,
        },
      },
      (response) => {
        syncBtn.disabled = false;
        if (response && response.ok) {
          const r = response.result;
          statusDiv.textContent = `${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged`;
          statusDiv.className = "success";
        } else {
          statusDiv.textContent = response
            ? response.error
            : "Sync failed.";
          statusDiv.className = "error";
        }
      },
    );
  });
});
