import cfg from './config.js';
import { getMediaItems, getLoopChannelFiles } from './mediaLibrary.js';

function xmlEscape(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// XMLTV timestamp: YYYYMMDDHHMMSS +0000
function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())} +0000`
  );
}

// Build a small local XMLTV guide for the loop channels (and a generic entry
// per VOD group) so they show up nicely in IPTV guides. Upstream live channels
// keep their own EPG via the playlist's url-tvg.
export function buildEpg() {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="mac-iptv-server">'];

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // --- Loop channels: a rolling schedule from the folder's files ---
  for (const ch of cfg.loopChannels || []) {
    out.push(`  <channel id="${xmlEscape(ch.id)}">`);
    out.push(`    <display-name>${xmlEscape(ch.name)}</display-name>`);
    if (ch.logo) out.push(`    <icon src="${xmlEscape(ch.logo)}" />`);
    out.push('  </channel>');
  }

  for (const ch of cfg.loopChannels || []) {
    const files = getLoopChannelFiles(ch);
    // Lay out programmes across 24h in fixed 1h blocks (placeholder schedule).
    const blockMs = 60 * 60 * 1000;
    const count = 24;
    for (let i = 0; i < count; i++) {
      const start = new Date(startOfDay.getTime() + i * blockMs);
      const stop = new Date(start.getTime() + blockMs);
      const title = files.length
        ? files[i % files.length].split('/').pop().replace(/\.[^.]+$/, '')
        : ch.name;
      out.push(`  <programme start="${fmt(start)}" stop="${fmt(stop)}" channel="${xmlEscape(ch.id)}">`);
      out.push(`    <title>${xmlEscape(title)}</title>`);
      out.push(`    <desc>${xmlEscape(`From ${ch.name}`)}</desc>`);
      out.push('  </programme>');
    }
  }

  // --- VOD items: single channel + one all-day programme so the name shows ---
  for (const item of getMediaItems()) {
    const id = `local.${item.id}`;
    out.push(`  <channel id="${xmlEscape(id)}">`);
    out.push(`    <display-name>${xmlEscape(item.name)}</display-name>`);
    out.push('  </channel>');
    const stop = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    out.push(`  <programme start="${fmt(startOfDay)}" stop="${fmt(stop)}" channel="${xmlEscape(id)}">`);
    out.push(`    <title>${xmlEscape(item.name)}</title>`);
    out.push(`    <desc>Local media</desc>`);
    out.push('  </programme>');
  }

  out.push('</tv>');
  return out.join('\n') + '\n';
}
