// Content script for the supported chat sites (D1). The fire button and site adapters
// (feature 09) mount here; for now it only confirms the script loads.
export default defineContentScript({
  matches: ["https://claude.ai/*", "https://chatgpt.com/*", "https://gemini.google.com/*"],
  runAt: "document_idle",
  main() {
    console.debug("[Promptio] content script loaded on", location.hostname);
  },
});
