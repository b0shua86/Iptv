# Jellyfin + Threadfin IPTV stack (Mac mini)

An open-source replacement for the custom server. It does everything you wanted:

- **Streams your Mac mini's media** (`/Users/miller/Videos`) to any TV.
- **Live TV channels** from the [Free-TV/IPTV](https://github.com/Free-TV/IPTV)
  playlist, **filtered** by Threadfin so you only see channels that work.
- **Channel changing on the TV** via the native Jellyfin guide — using official
  apps on your **Fire TV** and **LG webOS** TV.

```
 Free-TV playlist ─▶ Threadfin (pick good channels, build clean M3U+EPG)
                              │
        /Users/miller/Videos ─┤
                              ▼
                          Jellyfin ──▶ Fire TV app / LG app / browser
```

---

## 1. Install Docker Desktop (one time)

Download and install **Docker Desktop for Mac** from
<https://www.docker.com/products/docker-desktop/> (it's a normal `.dmg` — drag
to Applications, open it, leave it running). It puts a whale icon in your menu
bar; wait until it says "Docker Desktop is running".

> Apple Silicon vs Intel is auto-detected — the images below are multi-arch.

## 2. Start the stack

In Terminal:

```bash
cd ~/mac-iptv-server/jellyfin-stack   # wherever you cloned this repo
docker compose up -d
```

First run pulls the images (a few minutes). Check it's up:

```bash
docker compose ps
```

You should see `jellyfin` and `threadfin` both "running".

- Jellyfin:  http://192.168.4.24:8096
- Threadfin: http://192.168.4.24:34400

(Replace `192.168.4.24` if your Mac's IP changed — find it in System Settings →
Network. Reserve it in your router so it stays put.)

---

## 3. Configure Threadfin (pick your live channels)

Open **http://192.168.4.24:34400** in a browser.

1. **Playlist** tab → **+ New** → add an M3U:
   - Name: `Free-TV`
   - Type: **M3U**, Source: **URL**
   - URL: `https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8`
   - Save. Threadfin downloads ~1,900 channels.
2. **XMLTV** tab → **+ New** → add a guide (pick the ones for your region; you
   can add several). For the US:
   - `https://epgshare01.online/epgshare01/epg_ripper_US1.xml.gz`
   - (UK: `..._UK1.xml.gz`, Canada: `..._CA1.xml.gz`, etc.)
3. **Filter** / **Mapping** tab → this is the important part. Threadfin lists
   every channel **inactive** by default. **Activate only the ones you want**
   (search by name or group, e.g. activate your favorite news/entertainment
   channels). Skip anything marked geo-blocked you can't watch. For each active
   channel, map it to the matching EPG id if it isn't auto-matched.
4. Threadfin now publishes a clean playlist + guide at:
   - M3U:   `http://threadfin:34400/m3u/threadfin.m3u`
   - XMLTV: `http://threadfin:34400/xmltv/threadfin.xml`

   (Those `threadfin` hostnames work **from inside Jellyfin** because both run in
   the same Docker network — use them in the next step. From your laptop browser
   you'd use `http://192.168.4.24:34400/...` instead.)

> Tip: in Threadfin **Settings**, you can cap "Tuner / connections" and enable
> buffering — leave defaults to start.

---

## 4. Configure Jellyfin

Open **http://192.168.4.24:8096** and run the first-time wizard (create your
admin user; skip the library step or add it now — your choice).

### Add your media library
Dashboard → **Libraries** → **Add Media Library**:
- Content type: **Movies** (or Shows/Mixed as appropriate)
- Folder: **`/media`**  ← this is your `/Users/miller/Videos` mounted into the container
- Save. Jellyfin scans and builds your library.

### Add Live TV (the Threadfin channels)
Dashboard → **Live TV** → **Tuner Devices** → **+** :
- Tuner type: **M3U Tuner**
- File or URL: `http://threadfin:34400/m3u/threadfin.m3u`
- Save.

Then **TV Guide Data Providers** → **+** → **XMLTV**:
- File or URL: `http://threadfin:34400/xmltv/threadfin.xml`
- Save, then map any unmatched channels.

Jellyfin will refresh the guide; your channels appear under **Live TV** with a
full program grid.

---

## 5. Install the TV apps

- **Fire TV:** Appstore → search **Jellyfin** → install. Open it, and either
  sign in to `http://192.168.4.24:8096` or let it auto-discover the server on
  your LAN. Live TV + your media are right there; use the remote to change
  channels in the guide.
- **LG webOS:** LG Content Store → search **Jellyfin** → install → same login.
- **Anything else:** http://192.168.4.24:8096 in a browser, or the Jellyfin
  mobile apps.

---

## Notes

- **Transcoding in Docker on a Mac is CPU-only** (Docker can't use Apple's
  VideoToolbox). Files already in H.264/MP4 usually *direct play* with no
  transcoding; only odd codecs hit the CPU. A Mac mini handles a couple of
  simultaneous transcodes fine. If you want GPU-accelerated transcoding, the
  native Jellyfin macOS app can use VideoToolbox — ask me and I'll switch you.
- Keep this on your LAN. Don't port-forward 8096/34400 to the internet without a
  reverse proxy + auth.
- Update everything later with: `docker compose pull && docker compose up -d`.
- Your data lives in `jellyfin-stack/jellyfin/` and `jellyfin-stack/threadfin/`
  (created on first run); these are gitignored.
