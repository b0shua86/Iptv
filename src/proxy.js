import { Readable } from 'node:stream';
import cfg from './config.js';

// A normal-looking browser UA; many CDNs reject the default Node fetch UA.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function proxify(absUrl, base) {
  return `${base}/proxy?url=${encodeURIComponent(absUrl)}`;
}

// Rewrite every URL inside an HLS playlist so it also flows through us.
function rewriteM3U8(text, sourceUrl, base) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) {
        // Tags can carry URIs (EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP…).
        return line.replace(/URI="([^"]+)"/g, (m, uri) => {
          try {
            return `URI="${proxify(new URL(uri, sourceUrl).href, base)}"`;
          } catch {
            return m;
          }
        });
      }
      // A segment or sub-playlist URL line.
      try {
        return proxify(new URL(t, sourceUrl).href, base);
      } catch {
        return line;
      }
    })
    .join('\n');
}

// GET /proxy?url=...  (also reachable as /proxy.m3u8?url=... so players that
// sniff the extension treat it as HLS)
export async function handleProxy(req, res) {
  const target = req.query.url;
  if (!target) return res.status(400).send('missing url');

  let urlObj;
  try {
    urlObj = new URL(target);
  } catch {
    return res.status(400).send('bad url');
  }
  if (!/^https?:$/.test(urlObj.protocol)) return res.status(400).send('bad scheme');

  const base = cfg.serverUrl;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  res.on('close', () => controller.abort());

  try {
    const upstream = await fetch(target, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Referer: `${urlObj.protocol}//${urlObj.host}/`,
        Origin: `${urlObj.protocol}//${urlObj.host}`,
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      },
    });

    res.set('Access-Control-Allow-Origin', '*');

    const ct = (upstream.headers.get('content-type') || '').toLowerCase();
    const looksLikePlaylist =
      /mpegurl|m3u8/.test(ct) || /\.m3u8(\?|$)/i.test(urlObj.pathname + urlObj.search);

    if (looksLikePlaylist) {
      const text = await upstream.text();
      clearTimeout(timeout);
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Cache-Control', 'no-cache');
      return res.send(rewriteM3U8(text, upstream.url || target, base));
    }

    // Binary passthrough for segments / keys, preserving range semantics.
    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) res.set(h, v);
    }
    if (!upstream.body) {
      clearTimeout(timeout);
      return res.end();
    }
    Readable.fromWeb(upstream.body)
      .on('error', () => res.destroy())
      .pipe(res)
      .on('finish', () => clearTimeout(timeout));
  } catch (err) {
    clearTimeout(timeout);
    if (!res.headersSent) res.status(502).send(`proxy error: ${err.message}`);
    else res.end();
  }
}
