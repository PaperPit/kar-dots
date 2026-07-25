// src/content-app-bridge.ts
var PAGE_TYPE = "KAR_EXT_CONNECT";
var PAGE_ACK = "KAR_EXT_CONNECT_ACK";
var PAGE_STATUS = "KAR_EXT_CONNECT_STATUS";
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== PAGE_TYPE) return;
  chrome.runtime.sendMessage(
    {
      type: "AUTH_CONNECT",
      session: data.session,
      supabaseUrl: data.supabaseUrl,
      anonKey: data.anonKey
    },
    (response) => {
      const err = chrome.runtime.lastError;
      window.postMessage(
        {
          type: PAGE_ACK,
          ok: !err && !!response?.ok,
          error: err?.message || response?.error || null
        },
        "*"
      );
    }
  );
});
window.postMessage({ type: PAGE_STATUS, installed: true }, "*");
//# sourceMappingURL=content-app-bridge.js.map
