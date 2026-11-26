// Privacy fork: rendering a thread, link or tab never fetches a remote icon (no Google favicon
// service, no site /favicon.ico, no CDN). Only inline data: icons from provider events show;
// callers fall back to their bundled placeholder icons.

function inlineFaviconUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || rawUrl.length > 4096) return null;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "data:" ? url.href : null;
  } catch {
    return null;
  }
}

export function toolActivityFaviconUrl(
  icon: {
    readonly pageUrl: string;
    readonly faviconUrl?: string | undefined;
    readonly faviconUrlDark?: string | undefined;
  },
  appearance: "light" | "dark",
  _size = 32,
): string | null {
  if (appearance === "dark") {
    return inlineFaviconUrl(icon.faviconUrlDark) ?? inlineFaviconUrl(icon.faviconUrl);
  }
  return inlineFaviconUrl(icon.faviconUrl);
}

export function faviconUrlForOrigin(_rawUrl: string | null | undefined, _size = 32): string | null {
  return null;
}
