// Background service worker. API calls to Jev and Anthropic will run here (not in the content
// script) so they aren't subject to the chat site's CORS rules and keys never touch the page.
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") void browser.runtime.openOptionsPage();
  });
});
