import { describe, expect, it } from "@effect/vitest";

import { faviconUrlForOrigin, toolActivityFaviconUrl } from "./favicon.ts";

// Privacy fork: rendering never requests a remote icon.
describe("faviconUrlForOrigin", () => {
  it.each([null, "invalid URL", "file:///tmp/private", "https://github.com:8443/pingdotgg/t3code"])(
    "never builds a favicon request for %s",
    (origin) => {
      expect(faviconUrlForOrigin(origin)).toBeNull();
    },
  );
});

describe("toolActivityFaviconUrl", () => {
  it("never fetches a page, CDN or provider-supplied remote icon", () => {
    const icon = {
      pageUrl: "https://github.com/pingdotgg/t3code",
      faviconUrl: "https://example.com/icon.png",
      faviconUrlDark: "http://example.com/icon-dark.png",
    };
    expect(toolActivityFaviconUrl(icon, "light")).toBeNull();
    expect(toolActivityFaviconUrl(icon, "dark")).toBeNull();
    expect(toolActivityFaviconUrl({ pageUrl: "https://example.com/docs" }, "light")).toBeNull();
  });

  it("keeps inline data icons, preferring the dark variant in dark mode", () => {
    const light = "data:image/png;base64,AAAA";
    const dark = "data:image/png;base64,BBBB";
    expect(toolActivityFaviconUrl({ pageUrl: "https://x.test", faviconUrl: light }, "dark")).toBe(
      light,
    );
    expect(
      toolActivityFaviconUrl(
        { pageUrl: "https://x.test", faviconUrl: light, faviconUrlDark: dark },
        "dark",
      ),
    ).toBe(dark);
    expect(
      toolActivityFaviconUrl(
        { pageUrl: "https://x.test", faviconUrl: "chrome-extension://x/i.png" },
        "light",
      ),
    ).toBeNull();
  });
});
