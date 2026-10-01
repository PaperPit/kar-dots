// src/content-app-bridge.ts
var PAGE_STATUS = "KAR_EXT_CONNECT_STATUS";
function bridgeContextAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}
if (bridgeContextAlive()) {
  window.postMessage({ type: PAGE_STATUS, installed: true }, location.origin);
}
//# sourceMappingURL=content-app-bridge.js.map
