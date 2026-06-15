(() => {
  const listEl = document.getElementById('channelList');
  const searchEl = document.getElementById('search');
  const groupEl = document.getElementById('groupFilter');
  const statusEl = document.getElementById('status');
  const video = document.getElementById('video');
  const npName = document.getElementById('npName');

  let all = [];        // full channel list from API
  let view = [];       // currently filtered+rendered list
  let selected = 0;    // keyboard-highlighted index in view
  let playing = -1;    // index in view currently playing
  let hls = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  async function load() {
    setStatus('Loading channels…');
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      all = data.channels || [];
      const groups = [...new Set(all.map((c) => c.group))].sort();
      for (const g of groups) {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        groupEl.appendChild(opt);
      }
      const liveNote = data.liveError ? ` (live unavailable: ${data.liveError})` : '';
      setStatus(`${all.length} channels${liveNote}`);
      render();
    } catch (err) {
      setStatus('Failed to load channels: ' + err.message);
    }
  }

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    const g = groupEl.value;
    view = all.filter((c) =>
      (!g || c.group === g) && (!q || c.name.toLowerCase().includes(q))
    );
    listEl.innerHTML = '';
    view.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'ch';
      li.dataset.index = i;
      const badge = c.type === 'vod' ? '<span class="badge vod">VOD</span>'
        : c.type === 'loop' ? '<span class="badge loop">24/7</span>'
        : '<span class="badge">LIVE</span>';
      li.innerHTML =
        (c.logo ? `<img src="${c.logo}" onerror="this.style.visibility='hidden'"/>` : '<img/>') +
        `<div class="meta"><div class="name">${escapeHtml(c.name)}</div>` +
        `<div class="grp">${escapeHtml(c.group)}</div></div>` + badge;
      li.addEventListener('click', () => { selected = i; play(i); });
      listEl.appendChild(li);
    });
    if (selected >= view.length) selected = Math.max(0, view.length - 1);
    highlight();
  }

  function highlight() {
    [...listEl.children].forEach((el, i) => {
      el.classList.toggle('selected', i === selected);
      el.classList.toggle('active', i === playing);
    });
    const cur = listEl.children[selected];
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function play(i) {
    const c = view[i];
    if (!c) return;
    playing = i;
    npName.textContent = c.name;
    highlight();

    if (hls) { hls.destroy(); hls = null; }
    const isHls = /\.m3u8(\?|$)/i.test(c.url);

    if (isHls && window.Hls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(c.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setStatus(`Stream error on "${c.name}" (${data.type})`);
      });
    } else {
      // Native playback: Safari/HLS, or progressive MP4 / MPEG-TS from local media.
      video.src = c.url;
    }
    video.play().catch(() => {});
  }

  function step(delta) {
    if (!view.length) return;
    selected = (selected + delta + view.length) % view.length;
    highlight();
  }

  // Keyboard / TV-remote navigation.
  document.addEventListener('keydown', (e) => {
    // Don't hijack typing in the search box.
    if (document.activeElement === searchEl) {
      if (e.key === 'Enter') { e.preventDefault(); listEl.focus(); if (view.length) { selected = 0; play(0); } }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); step(1); break;
      case 'ArrowUp': e.preventDefault(); step(-1); break;
      case 'PageDown': case 'ChannelUp': e.preventDefault(); step(1); play(selected); break;
      case 'PageUp': case 'ChannelDown': e.preventDefault(); step(-1); play(selected); break;
      case 'Enter': e.preventDefault(); play(selected); break;
      default: break;
    }
  });

  searchEl.addEventListener('input', render);
  groupEl.addEventListener('change', render);

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  load();
})();
