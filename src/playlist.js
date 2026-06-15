import cfg from './config.js';
import { getLiveChannels } from './livePlaylist.js';
import { getMediaItems } from './mediaLibrary.js';

function extinf({ id = '', logo = '', group = '', name }) {
  const attrs = [
    `tvg-id="${id}"`,
    `tvg-logo="${logo}"`,
    `group-title="${group}"`,
  ].join(' ');
  return `#EXTINF:-1 ${attrs},${name}`;
}

// Build the combined M3U that TVs / IPTV apps load. `base` is the absolute URL
// the client used to reach us (e.g. http://192.168.1.50:8409), so the embedded
// links always point back at a reachable address.
export async function buildPlaylist(base) {
  base = (base || cfg.serverUrl).replace(/\/+$/, '');
  const live = await getLiveChannels();
  const media = getMediaItems();

  // Point players at the upstream EPG (for live channels) + our local EPG.
  const tvgParts = [];
  if (live.tvgUrl) tvgParts.push(...live.tvgUrl.split(',').map((s) => s.trim()).filter(Boolean));
  tvgParts.push(`${base}/epg.xml`);

  const out = [`#EXTM3U url-tvg="${tvgParts.join(',')}" x-tvg-url="${tvgParts.join(',')}"`];

  // Local "loop" channels first so they sit at the top of the guide.
  for (const ch of cfg.loopChannels || []) {
    out.push(
      extinf({
        id: ch.id,
        logo: ch.logo || '',
        group: ch.group || 'Local Channels',
        name: ch.name,
      })
    );
    out.push(`${base}/channel/${encodeURIComponent(ch.id)}`);
  }

  // Local media VOD entries.
  for (const item of media) {
    out.push(
      extinf({
        id: `local.${item.id}`,
        group: item.group,
        name: item.name,
      })
    );
    out.push(`${base}/media/${item.id}`);
  }

  // Live channels (verbatim stream URLs from upstream).
  for (const ch of live.channels) {
    out.push(
      extinf({
        id: ch.id,
        logo: ch.logo,
        group: ch.group,
        name: ch.name,
      })
    );
    out.push(ch.url);
  }

  return out.join('\n') + '\n';
}
