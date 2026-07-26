// src/content-app-bridge.ts
var PAGE_TYPE = "KAR_EXT_CONNECT";
var PAGE_ACK = "KAR_EXT_CONNECT_ACK";
var PAGE_STATUS = "KAR_EXT_CONNECT_STATUS";
var RELOADED_MSG = "\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0431\u044B\u043B\u043E \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E \u2014 \u043E\u0431\u043D\u043E\u0432\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043D\u043E\u0432\u0430";
function bridgeContextAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}
function reply(ok, error) {
  window.postMessage({ type: PAGE_ACK, ok, error }, location.origin);
}
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== PAGE_TYPE) return;
  if (!bridgeContextAlive()) {
    reply(false, RELOADED_MSG);
    return;
  }
  try {
    chrome.runtime.sendMessage(
      {
        type: "AUTH_CONNECT",
        session: data.session,
        supabaseUrl: data.supabaseUrl,
        anonKey: data.anonKey
      },
      (response) => {
        const err = chrome.runtime.lastError;
        reply(!err && !!response?.ok, err?.message || response?.error || null);
      }
    );
  } catch {
    reply(false, RELOADED_MSG);
  }
});
if (bridgeContextAlive()) {
  window.postMessage({ type: PAGE_STATUS, installed: true }, location.origin);
}
//# sourceMappingURL=content-app-bridge.js.map
