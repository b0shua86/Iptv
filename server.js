import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cfg from './src/config.js';
import { startLiveRefresh, getLiveChannels } from './src/livePlaylist.js';
import { startMediaRescan, getMediaItems, scanMedia } from './src/mediaLibrary.js';
import { buildPlaylist } from './src/playlist.js';
import { buildEpg } from './src/epg.js';
import { handleMedia, handleLoopChannel } from './src/stream.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

// --- Playlists / guide ---
app.get(['/playlist.m3u', '/playlist.m3u8'], async (req, res) => {
  try {
    const body = await buildPlaylist();
    res.set('Content-Type', 'audio/x-mpegurl');
    res.send(body);
  } catch (err) {
    console.error('[playlist] build failed:', err);
    res.status(500).send('# playlist error');
  }
});

app.get('/epg.xml', (req, res) => {
  res.set('Content-Type', 'application/xml');
  res.send(buildEpg());
});

// --- Streaming ---
app.get('/media/:id', handleMedia);
app.get('/channel/:id', handleLoopChannel);

// --- JSON API for the built-in web player ---
app.get('/api/channels', async (req, res) => {
  const live = await getLiveChannels();
  const media = getMediaItems();
  const base = cfg.serverUrl;

  const loop = (cfg.loopChannels || []).map((c) => ({
    name: c.name,
    group: c.group || 'Local Channels',
    logo: c.logo || '',
    type: 'loop',
    url: `${base}/channel/${encodeURIComponent(c.id)}`,
  }));

  const vod = media.map((m) => ({
    name: m.name,
    group: m.group,
    logo: '',
    type: 'vod',
    url: `${base}/media/${m.id}`,
  }));

  const liveList = live.channels.map((c) => ({
    name: c.name,
    group: c.group,
    logo: c.logo,
    type: 'live',
    url: c.url,
  }));

  res.json({
    serverUrl: base,
    liveError: live.error,
    channels: [...loop, ...vod, ...liveList],
  });
});

app.post('/api/rescan', (req, res) => {
  scanMedia();
  res.json({ ok: true, count: getMediaItems().length });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, serverUrl: cfg.serverUrl, mediaDir: cfg.mediaDir });
});

// --- Web player UI ---
app.use(express.static(path.join(__dirname, 'public')));

app.listen(cfg.port, cfg.host, () => {
  startLiveRefresh();
  startMediaRescan();
  console.log('');
  console.log('  Mac IPTV Server is running.');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Web player : ${cfg.serverUrl}/`);
  console.log(`  Playlist   : ${cfg.serverUrl}/playlist.m3u`);
  console.log(`  EPG guide  : ${cfg.serverUrl}/epg.xml`);
  console.log(`  Media dir  : ${cfg.mediaDir}`);
  console.log('  ─────────────────────────────────────────────');
  console.log('  Add the Playlist URL to IPTV Smarters / TiViMate on your TVs.');
  console.log('');
});
