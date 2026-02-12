const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const portInput = document.getElementById("port-input");
const reconnectBtn = document.getElementById("reconnect-btn");

function updateUI(connected, port) {
  statusDot.className = `dot ${connected ? "connected" : "disconnected"}`;
  statusText.textContent = connected ? "Connected" : "Disconnected";
  if (port) portInput.value = port;
}

// Get initial status
chrome.runtime.sendMessage({ type: "get-status" }, (response) => {
  if (response) {
    updateUI(response.connected, response.port);
  }
});

// Reconnect with potentially new port
reconnectBtn.addEventListener("click", () => {
  const newPort = parseInt(portInput.value, 10);
  if (isNaN(newPort) || newPort < 1024 || newPort > 65535) {
    statusText.textContent = "Invalid port";
    return;
  }

  chrome.storage.local.set({ port: newPort });
  chrome.runtime.sendMessage({ type: "set-port", port: newPort }, () => {
    statusText.textContent = "Reconnecting...";
    // Poll for status update
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "get-status" }, (response) => {
        if (response) updateUI(response.connected, response.port);
      });
    }, 1500);
  });
});
