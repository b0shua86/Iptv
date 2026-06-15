import cfg from './config.js';

// In-memory cache of the upstream Free-TV playlist.
let cache = {
  fetchedAt: 0,
  raw: '',
  channels: [],
  tvgUrl: '',
  error: null,
};

function parseAttrs(line) {
  const attrs = {};
  const re = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

// Parse an M3U body into channel objects.
export function parseM3U(raw) {
  const lines = raw.split(/\r?\n/);
  const channels = [];
  let tvgUrl = '';
  let pending = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#EXTM3U')) {
      const m = trimmed.match(/(?:x-tvg-url|url-tvg)="([^"]*)"/i);
      if (m) tvgUrl = m[1];
      continue;
    }

    if (trimmed.startsWith('#EXTINF')) {
      const attrs = parseAttrs(trimmed);
      const name = trimmed.split(',').slice(1).join(',').trim();
      pending = {
        name: name || attrs['tvg-name'] || 'Unknown',
        id: attrs['tvg-id'] || '',
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || 'Live TV',
        country: attrs['tvg-country'] || '',
        url: '',
      };
      continue;
    }

    if (trimmed.startsWith('#')) continue; // other tags

    if (pending) {
      pending.url = trimmed;
      channels.push(pending);
      pending = null;
    }
  }

  return { channels, tvgUrl };
}

async function fetchUpstream() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(cfg.livePlaylistUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const { channels, tvgUrl } = parseM3U(raw);

    let filtered = channels;
    if (Array.isArray(cfg.liveCountries) && cfg.liveCountries.length) {
      const wanted = cfg.liveCountries.map((c) => c.toLowerCase());
      filtered = channels.filter((c) =>
        wanted.some((w) => c.group.toLowerCase().includes(w) || c.country.toLowerCase() === w)
      );
    }

    cache = { fetchedAt: Date.now(), raw, channels: filtered, tvgUrl, error: null };
    console.log(`[live] Loaded ${filtered.length} live channels${filtered.length !== channels.length ? ` (filtered from ${channels.length})` : ''}.`);
  } catch (err) {
    cache.error = err.message;
    console.error(`[live] Failed to fetch upstream playlist: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getLiveChannels() {
  if (!cfg.includeLive) return { channels: [], tvgUrl: '', error: null };
  const ageMin = (Date.now() - cache.fetchedAt) / 60000;
  if (cache.fetchedAt === 0 || ageMin > cfg.liveRefreshMinutes) {
    await fetchUpstream();
  }
  return { channels: cache.channels, tvgUrl: cache.tvgUrl, error: cache.error };
}

// Kick off a background refresh on startup so the first request is fast.
export function startLiveRefresh() {
  if (!cfg.includeLive) return;
  fetchUpstream();
  setInterval(fetchUpstream, Math.max(5, cfg.liveRefreshMinutes) * 60000);
}
