import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULTS = {
  port: 8409,
  host: '0.0.0.0',
  serverUrl: '',
  mediaDir: path.join(os.homedir(), 'Movies'),
  includeLive: true,
  livePlaylistUrl: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
  liveRefreshMinutes: 360,
  liveCountries: [],
  transcode: true,
  ffmpegPath: 'ffmpeg',
  ffprobePath: 'ffprobe',
  directPlayExtensions: ['.mp4', '.m4v', '.mov'],
  loopChannels: [],
};

// Strip "// foo" annotation keys used for inline docs in config.example.json.
function stripComments(obj) {
  if (Array.isArray(obj)) return obj.map(stripComments);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('//')) continue;
      out[k] = stripComments(v);
    }
    return out;
  }
  return obj;
}

function loadFile() {
  const candidates = [
    process.env.IPTV_CONFIG,
    path.join(ROOT, 'config.json'),
  ].filter(Boolean);
  for (const file of candidates) {
    if (file && fs.existsSync(file)) {
      try {
        return stripComments(JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch (err) {
        console.error(`[config] Failed to parse ${file}: ${err.message}`);
        process.exit(1);
      }
    }
  }
  console.warn('[config] No config.json found — using defaults. Copy config.example.json to config.json to customize.');
  return {};
}

function detectLanIp() {
  const ifaces = os.networkInterfaces();
  // Prefer common private ranges on a real interface.
  for (const list of Object.values(ifaces)) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return '127.0.0.1';
}

const fileCfg = loadFile();
const cfg = { ...DEFAULTS, ...fileCfg };

// Env overrides (handy for launchd / quick changes without editing JSON).
if (process.env.IPTV_PORT) cfg.port = Number(process.env.IPTV_PORT);
if (process.env.IPTV_MEDIA_DIR) cfg.mediaDir = process.env.IPTV_MEDIA_DIR;
if (process.env.IPTV_SERVER_URL) cfg.serverUrl = process.env.IPTV_SERVER_URL;

cfg.mediaDir = path.resolve(cfg.mediaDir);
cfg.lanIp = detectLanIp();
if (!cfg.serverUrl) {
  cfg.serverUrl = `http://${cfg.lanIp}:${cfg.port}`;
}
cfg.serverUrl = cfg.serverUrl.replace(/\/+$/, '');
cfg.root = ROOT;

export default cfg;
