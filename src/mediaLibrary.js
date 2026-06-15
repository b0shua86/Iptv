import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cfg from './config.js';

const VIDEO_EXTS = new Set([
  '.mp4', '.m4v', '.mov', '.mkv', '.avi', '.wmv', '.flv', '.webm',
  '.mpg', '.mpeg', '.ts', '.m2ts', '.3gp', '.ogv', '.divx', '.vob',
]);

let index = {
  scannedAt: 0,
  byId: new Map(),   // id -> { id, name, relPath, absPath, group, ext }
  items: [],
};

function makeId(relPath) {
  return crypto.createHash('sha1').update(relPath).digest('hex').slice(0, 12);
}

function walk(dir, baseDir, out, depth = 0) {
  if (depth > 12) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip hidden / .DS_Store
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, baseDir, out, depth + 1);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;
      const relPath = path.relative(baseDir, abs);
      const parent = path.dirname(relPath);
      const group = parent === '.' ? 'Local Media' : `Local · ${parent.split(path.sep)[0]}`;
      out.push({
        id: makeId(relPath),
        name: path.basename(entry.name, ext),
        relPath,
        absPath: abs,
        group,
        ext,
      });
    }
  }
}

export function scanMedia() {
  const items = [];
  if (fs.existsSync(cfg.mediaDir)) {
    walk(cfg.mediaDir, cfg.mediaDir, items);
  } else {
    console.warn(`[media] mediaDir does not exist: ${cfg.mediaDir}`);
  }
  items.sort((a, b) => a.relPath.localeCompare(b.relPath));
  const byId = new Map(items.map((i) => [i.id, i]));
  index = { scannedAt: Date.now(), byId, items };
  console.log(`[media] Indexed ${items.length} media files from ${cfg.mediaDir}`);
  return index;
}

export function getMediaItems() {
  if (index.scannedAt === 0) scanMedia();
  return index.items;
}

export function getMediaById(id) {
  if (index.scannedAt === 0) scanMedia();
  return index.byId.get(id) || null;
}

// Resolve a loop channel's folder + ordered file list.
export function getLoopChannelFiles(channel) {
  const base = path.isAbsolute(channel.path)
    ? channel.path
    : path.resolve(cfg.mediaDir, channel.path || '.');
  const files = [];
  walk(base, base, files);
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return files.map((f) => f.absPath);
}

export function startMediaRescan() {
  scanMedia();
  // Re-scan periodically so newly added files appear without a restart.
  setInterval(scanMedia, 15 * 60000);
}
