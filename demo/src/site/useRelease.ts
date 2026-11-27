import { useEffect, useState } from 'react';

const REPO = 'AchiraStudio/kivo';

export interface Asset { name: string; url: string; size: number }
export interface ReleaseInfo {
  version: string;
  date: string | null;
  pageUrl: string;
  windows: Asset | null;
  android: Asset | null;
  live: boolean; // false until the GitHub API answered
}

// The site is rebuilt on every release, but it also asks GitHub for the latest release at
// runtime, so download buttons are right even between deploys.
const FALLBACK: ReleaseInfo = {
  version: __APP_VERSION__,
  date: null,
  pageUrl: `https://github.com/${REPO}/releases/latest`,
  windows: null,
  android: null,
  live: false,
};

const CACHE_KEY = 'kivo-site-release';

export function useRelease(): ReleaseInfo {
  const [info, setInfo] = useState<ReleaseInfo>(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.info as ReleaseInfo;
    } catch { /* ignore */ }
    return FALLBACK;
  });

  useEffect(() => {
    if (info.live) return;
    let cancelled = false;
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rel) => {
        if (cancelled) return;
        const assets: { name: string; browser_download_url: string; size: number }[] = rel.assets || [];
        const pick = (re: RegExp, avoid?: RegExp): Asset | null => {
          const a = assets.find((x) => re.test(x.name) && !(avoid && avoid.test(x.name)));
          return a ? { name: a.name, url: a.browser_download_url, size: a.size } : null;
        };
        const next: ReleaseInfo = {
          version: String(rel.tag_name || FALLBACK.version).replace(/^v/i, ''),
          date: rel.published_at || null,
          pageUrl: rel.html_url || FALLBACK.pageUrl,
          windows: pick(/\.exe$/i) || pick(/\.msi$/i),
          android: pick(/\.apk$/i, /\.sha256$/i),
          live: true,
        };
        setInfo(next);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), info: next })); } catch { /* ignore */ }
      })
      .catch(() => { /* offline or rate limited: the fallback links still work */ });
    return () => { cancelled = true; };
  }, [info.live]);

  return info;
}

export const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
