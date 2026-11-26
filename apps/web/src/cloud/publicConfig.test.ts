import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { hasCloudPublicConfig, resolveCloudPublicConfig } from "./publicConfig.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Privacy fork: T3 Connect is disabled whatever the build environment supplies.
describe("hasCloudPublicConfig", () => {
  it.each(["https://example.com", "http://localhost:3773"])(
    "never enables Clerk or the relay, even with a complete production config: %s",
    (origin) => {
      vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", `pk_live_${btoa("clerk.example.com$")}`);
      vi.stubEnv("VITE_CLERK_JWT_TEMPLATE", "t3-relay");
      vi.stubEnv("VITE_T3CODE_RELAY_URL", "https://relay.example.test");
      vi.stubEnv("VITE_RELAY_OTLP_TRACES_URL", "https://traces.example.test");
      vi.stubGlobal("window", { location: new URL(origin) });

      expect(hasCloudPublicConfig()).toBe(false);
      expect(resolveCloudPublicConfig()).toEqual({
        clerkPublishableKey: null,
        clerkJwtTemplate: null,
        relayUrl: null,
        relayTracing: { tracesUrl: null, tracesDataset: null, tracesToken: null },
      });
    },
  );
});
