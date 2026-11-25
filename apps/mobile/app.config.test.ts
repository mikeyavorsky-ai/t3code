import { DEFAULT_HOSTED_APP_URL } from "@t3tools/shared/connectAuth";
import { afterEach, expect, it, vi } from "vite-plus/test";

import assetLinks from "../web/public/.well-known/assetlinks.json";

// Keep config parsing independent of local env files and build credentials.
vi.mock("../../scripts/lib/public-config.ts", () => ({
  loadRepoEnv: () => ({
    APP_VARIANT: process.env.APP_VARIANT,
    SWITCHBOARD_IOS_TEAM_ID: process.env.SWITCHBOARD_IOS_TEAM_ID,
    SWITCHBOARD_IOS_BUNDLE_ID: process.env.SWITCHBOARD_IOS_BUNDLE_ID,
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadConfig(
  variant: string | undefined,
  distribution?: { teamId: string; bundleId: string },
) {
  vi.resetModules();
  vi.stubEnv("APP_VARIANT", variant);
  vi.stubEnv("SWITCHBOARD_IOS_TEAM_ID", distribution?.teamId);
  vi.stubEnv("SWITCHBOARD_IOS_BUNDLE_ID", distribution?.bundleId);
  return (await import("./app.config.ts")).default;
}

it.each(["prod", ""])("rejects APP_VARIANT=%j before selecting production IDs", async (value) => {
  await expect(loadConfig(value)).rejects.toThrow(
    "APP_VARIANT must be development, preview, or production.",
  );
});

it.each([
  [undefined, "com.t3tools.t3code"],
  ["development", "com.t3tools.t3code.dev"],
  ["preview", "com.t3tools.t3code.preview"],
  ["production", "com.t3tools.t3code"],
])("keeps the iOS and Android identifiers for APP_VARIANT=%j", async (value, identifier) => {
  const config = await loadConfig(value);
  expect(config.ios?.bundleIdentifier).toBe(identifier);
  expect(config.android?.package).toBe(identifier);
  expect(config.ios?.associatedDomains).toBeUndefined();
  // Android still registers the upstream thread links.
  const host = new URL(DEFAULT_HOSTED_APP_URL).host;
  expect(config.android?.intentFilters?.[0]?.data).toEqual([
    { scheme: "https", host, pathPrefix: "/threads/" },
  ]);
  expect(assetLinks.map((link) => link.target.package_name)).toContain(identifier);
});

it("uses independent iOS distribution identifiers without hosted associated domains", async () => {
  const distribution = { teamId: "TESTTEAM01", bundleId: "com.example.switchboard" };
  const config = await loadConfig("production", distribution);
  expect(config.ios?.bundleIdentifier).toBe(distribution.bundleId);
  expect(config.ios?.appleTeamId).toBe(distribution.teamId);
  expect(config.ios?.associatedDomains).toBeUndefined();
  expect(config.android?.package).toBe("com.t3tools.t3code");
});
