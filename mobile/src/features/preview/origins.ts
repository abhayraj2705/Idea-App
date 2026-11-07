import { config } from '@/lib/config';

export function originOf(url: string): string | null {
  const m = url.match(/^(https?:\/\/[^/?#]+)/i);
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * Only the platform's preview origins may load inside the WebView (§10, §13.3).
 * Everything else opens in the system browser.
 */
export function previewOrigins(previewUrl?: string): string[] {
  const set = new Set<string>();
  const api = originOf(config.apiUrl);
  if (api) set.add(api);
  const web = originOf(config.webUrl);
  if (web) {
    set.add(web);
    // preview subdomains, e.g. https://<id>.preview.ideaplatform.app
    const host = web.replace(/^https?:\/\//, '');
    set.add(`https://*.preview.${host}`);
  }
  if (previewUrl) {
    const o = originOf(previewUrl);
    if (o) set.add(o);
  }
  return [...set];
}

export function isAllowedUrl(url: string, origins: string[]): boolean {
  if (url === 'about:blank') return true;
  const o = originOf(url);
  if (!o) return false;
  return origins.some((allowed) => {
    if (allowed.includes('*')) {
      const re = new RegExp(`^${allowed.replace(/[.]/g, '\\.').replace('*', '[a-z0-9-]+')}$`, 'i');
      return re.test(o);
    }
    return allowed === o;
  });
}
