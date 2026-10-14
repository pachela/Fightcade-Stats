"use strict";

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return blobToDataUrl(await response.blob());
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "OPEN_DASHBOARD") {
    chrome.tabs.create(
      {
        url: chrome.runtime.getURL("dashboard.html")
      },
      (tab) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        sendResponse({
          ok: true,
          tabId: tab?.id || null
        });
      }
    );

    return true;
  }

  if (message.type === "FETCH_GAME_PREVIEW") {
    const rom = String(message.rom || "")
      .replace(/[^a-z0-9_-]/gi, "")
      .toLowerCase();

    if (!rom) {
      sendResponse({
        ok: false,
        error: "ROM inválida."
      });

      return false;
    }

    const url =
      `https://web.fightcade.com/static/previews/${rom}.png`;

    fetchAsDataUrl(url)
      .then((dataUrl) => {
        sendResponse({
          ok: true,
          dataUrl
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message
        });
      });

    return true;
  }

  if (message.type === "FETCH_BACKGROUND") {
    fetchAsDataUrl(chrome.runtime.getURL("background.png"))
      .then((dataUrl) => {
        sendResponse({
          ok: true,
          dataUrl
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message
        });
      });

    return true;
  }

  return false;
});