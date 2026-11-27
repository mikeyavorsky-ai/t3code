import { afterEach, expect, it, vi } from "vite-plus/test";

// Keep config parsing independent of local env files and build credentials.
vi.mock("../../scripts/lib/public-config.ts", () => ({
  loadRepoEnv: () => ({ APP_VARIANT: process.env.APP_VARIANT }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadConfig(variant: string | undefined) {
  vi.resetModules();
  vi.stubEnv("APP_VARIANT", variant);
  return (await import("./app.config.ts")).default;
}

it.each(["prod", ""])("rejects APP_VARIANT=%j before selecting production IDs", async (value) => {
  await expect(loadConfig(value)).rejects.toThrow(
    "APP_VARIANT must be development, preview, or production.",
  );
});

it.each([
  [undefined, "com.yavorsky.t3code", "com.t3tools.t3code"],
  ["development", "com.t3tools.t3code.dev", "com.t3tools.t3code.dev"],
  ["preview", "com.t3tools.t3code.preview", "com.t3tools.t3code.preview"],
  ["production", "com.yavorsky.t3code", "com.t3tools.t3code"],
])(
  "selects the identifiers for APP_VARIANT=%j",
  async (value, iosIdentifier, androidIdentifier) => {
    const config = await loadConfig(value);
    expect(config.ios?.bundleIdentifier).toBe(iosIdentifier);
    expect(config.ios?.appleTeamId).toBe("7AMKACNRU3");
    expect(config.ios?.entitlements?.["keychain-access-groups"]).toEqual([
      `$(AppIdentifierPrefix)${iosIdentifier}`,
    ]);
    // Privacy fork: no associated domains, so iOS never fetches app.t3.codes site association.
    expect(config.ios?.associatedDomains).toBeUndefined();
    expect(config.android?.package).toBe(androidIdentifier);
  },
);
