import { defineConfig } from "wxt";

// Extension shell lives in extension/; pure logic lives in core/ (no chrome APIs, reusable by the eval harness).
export default defineConfig({
  srcDir: "extension",
  manifest: {
    name: "Promptio",
    description: "Rewrites your prompt for the task at hand, part by part.",
    permissions: ["storage"],
    // API calls go through the background worker (D3: BYOK, no backend).
    host_permissions: ["https://api.anthropic.com/*", "https://api.typesafe.ai/*"],
  },
});
