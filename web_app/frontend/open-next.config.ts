import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Pages are prerendered or dynamic; nothing revalidates, so prerendered output is read from the Worker's assets.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
