import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import cfg from './config.js';
import { getMediaById, getLoopChannelFiles } from './mediaLibrary.js';

const MIME = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.ts': 'video/mp2t',
};

function isDirectPlay(ext) {
  return (cfg.directPlayExtensions || []).map((e) => e.toLowerCase()).includes(ext.toLowerCase());
}

// Stream a stored file directly, honoring HTTP Range so the player can seek.
function serveDirect(item, req, res) {
  const stat = fs.statSync(item.absPath);
  const range = req.headers.range;
  const mime = MIME[item.ext] || 'application/octet-stream';

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= stat.size) end = stat.size - 1;
    if (start > end) start = 0;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mime,
    });
    fs.createReadStream(item.absPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(item.absPath).pipe(res);
  }
}

// Transcode an arbitrary file to a broadly-compatible MPEG-TS stream on the fly.
function serveTranscode(inputArgs, res, label) {
  const args = [
    '-hide_banner', '-loglevel', 'error',
    ...inputArgs,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
    '-f', 'mpegts',
    '-muxdelay', '0', '-muxpreload', '0',
    'pipe:1',
  ];
  const ff = spawn(cfg.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  res.writeHead(200, {
    'Content-Type': 'video/mp2t',
    'Cache-Control': 'no-cache',
    Connection: 'close',
  });
  ff.stdout.pipe(res);

  let errBuf = '';
  ff.stderr.on('data', (d) => {
    errBuf += d.toString();
    if (errBuf.length > 4000) errBuf = errBuf.slice(-4000);
  });
  ff.on('error', (err) => {
    console.error(`[stream] ffmpeg spawn failed (${label}): ${err.message}. Is ffmpeg installed?`);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  ff.on('close', (code) => {
    if (code && code !== 0 && code !== 255) {
      console.error(`[stream] ffmpeg exited ${code} (${label}): ${errBuf.trim().split('\n').slice(-2).join(' ')}`);
    }
    res.end();
  });

  // Kill ffmpeg as soon as the player disconnects (e.g. user changes channel).
  res.on('close', () => {
    if (!ff.killed) ff.kill('SIGKILL');
  });
}

// VOD endpoint: /media/:id
export function handleMedia(req, res) {
  const item = getMediaById(req.params.id);
  if (!item) return res.status(404).send('Not found');
  if (!fs.existsSync(item.absPath)) return res.status(404).send('File missing');

  const forceTranscode = req.query.transcode === '1';
  if (!forceTranscode && isDirectPlay(item.ext)) {
    try {
      return serveDirect(item, req, res);
    } catch (err) {
      console.error(`[stream] direct serve failed, falling back to transcode: ${err.message}`);
    }
  }
  if (!cfg.transcode) {
    // Transcoding disabled: best-effort direct serve.
    return serveDirect(item, req, res);
  }
  serveTranscode(['-i', item.absPath], res, item.name);
}

// Always-on loop channel: /channel/:id
export function handleLoopChannel(req, res) {
  const ch = (cfg.loopChannels || []).find((c) => c.id === req.params.id);
  if (!ch) return res.status(404).send('Unknown channel');

  const files = getLoopChannelFiles(ch);
  if (!files.length) return res.status(404).send('Channel folder has no playable files');

  // Build a concat list file and loop it forever.
  const listPath = path.join(cfg.root, `.loop-${ch.id}.txt`);
  const body = files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n';
  fs.writeFileSync(listPath, body);

  serveTranscode(
    ['-stream_loop', '-1', '-f', 'concat', '-safe', '0', '-i', listPath],
    res,
    `loop:${ch.name}`
  );
}
