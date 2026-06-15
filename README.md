# Mac IPTV Server

A self-hosted IPTV server that runs on your **Mac mini** and streams to your TVs.

It does three things:

1. **Live TV** — serves the maintained [Free-TV/IPTV](https://github.com/Free-TV/IPTV)
   playlist of free, legal, HD live channels (with the program guide / EPG).
2. **Your media** — streams the video files stored on your Mac mini to any TV,
   transcoding on the fly so they always play.
3. **One playlist** — combines both into a single M3U + EPG that any IPTV app
   (or the built-in web player) can load. **The person at the TV browses the
   channel list / guide and changes channels normally** — nothing is locked.

Your TVs (an **LG webOS** TV and a **Fire TV**) connect either by:
- pasting the **Playlist URL** into a free IPTV app (recommended, most reliable), or
- opening the **built-in web player** in a browser.

---

## What you need

- A Mac mini on your home network (stays on to serve the TVs).
- [Homebrew](https://brew.sh) (to install Node + ffmpeg).
- Node.js 18+ and ffmpeg:
  ```bash
  brew install node ffmpeg
  ```

## Install (on the Mac mini)

```bash
git clone <this-repo> mac-iptv-server
cd mac-iptv-server
bash install/setup.sh
```

The setup script installs dependencies, creates `config.json`, and offers to
start the server automatically at login. **Edit `config.json`** and set
`mediaDir` to the folder you keep videos in, for example:

```json
"mediaDir": "/Users/yourname/Movies"
```

Then start it (if you didn't enable auto-start):

```bash
npm start
```

You'll see something like:

```
  Web player : http://192.168.1.50:8409/
  Playlist   : http://192.168.1.50:8409/playlist.m3u
  EPG guide  : http://192.168.1.50:8409/epg.xml
```

That `192.168.1.50:8409` is **your server address** — you'll use it on the TVs.
(Tip: give the Mac mini a static/reserved IP in your router so the address
never changes.)

---

## Connect your TVs

### Fire TV (recommended app: IPTV Smarters Pro or TiViMate)

1. From the Fire TV home screen, search the App Store for **IPTV Smarters Pro**
   (or **TiViMate**) and install it.
2. Open it → **Add User / Playlist** → choose **Load from M3U URL / Xtream**.
3. **M3U URL:** `http://192.168.1.50:8409/playlist.m3u`
4. **EPG URL** (if asked): `http://192.168.1.50:8409/epg.xml`
5. Save. Your channels (Local 24/7, Local media, then live TV) appear, grouped.
   Use the remote's up/down / channel buttons to change channels.

### LG webOS TV — two options

**Option A — IPTV app (best quality):** Install **IPTV Smarters** or
**OTT Navigator** from the LG Content Store and add the same M3U + EPG URLs as above.

**Option B — built-in web player (no app needed):** Open the LG **Web Browser**
and go to:
```
http://192.168.1.50:8409/
```
You get a channel list with search + groups and a video player. Use the remote's
**arrow keys** (or Channel +/-) to move through channels, **Enter/OK** to play.

### Any phone, tablet, or computer

Open `http://192.168.1.50:8409/` in any browser for the same web player.

> **How the web player plays live channels:** browsers block cross-origin
> streams (CORS), so the web player routes live channels through the server's
> built-in `/proxy` endpoint — your Mac fetches the stream (with a browser
> User-Agent) and re-serves it to the browser. IPTV apps on the TV play the
> stream URLs directly and don't need the proxy. Note: a few Free-TV entries
> are YouTube/Twitch *page* links rather than direct streams — those are hidden
> from the web player (they still appear for IPTV apps that can resolve them).

---

## Streaming your own media

- Every video file under `mediaDir` (and its subfolders) shows up as a **VOD**
  entry, grouped by its folder. Pick it on the TV to play.
- Supported source formats include mp4, mkv, mov, avi, wmv, ts, webm and more.
  `.mp4/.m4v/.mov` stream directly (seekable); anything else is transcoded to a
  TV-friendly stream on the fly via ffmpeg.
- Newly added files appear automatically (re-scanned every 15 min, or POST to
  `/api/rescan`).

### Optional: a 24/7 "channel" from a folder

Want a folder of videos to play forever like a real TV station (so it sits in the
guide and the TV viewer can just tune to it)? Add it to `loopChannels` in
`config.json`:

```json
"loopChannels": [
  { "id": "kids-247", "name": "Kids Channel", "path": "Kids", "group": "Local Channels" }
]
```

`path` is relative to `mediaDir` (or an absolute path). It loops the folder's
files endlessly. (Requires ffmpeg.)

---

## Configuration (`config.json`)

| Key | Meaning |
| --- | --- |
| `port` | Port the server listens on (default `8409`). |
| `serverUrl` | Force the base URL TVs use. Leave `""` to auto-detect your LAN IP. |
| `mediaDir` | Folder of your media to stream. |
| `includeLive` | Include the Free-TV live channels (`true`/`false`). |
| `liveCountries` | Optional whitelist, e.g. `["USA","United Kingdom"]`, to trim the live list. |
| `liveRefreshMinutes` | How often to refresh the upstream live playlist. |
| `transcode` | Transcode incompatible local files on the fly (needs ffmpeg). |
| `directPlayExtensions` | Extensions streamed as-is without transcoding. |
| `loopChannels` | Always-on channels built from folders (see above). |

---

## Endpoints

| URL | Purpose |
| --- | --- |
| `/` | Built-in web player. |
| `/playlist.m3u` | Combined M3U for IPTV apps. |
| `/epg.xml` | Local XMLTV guide (loop channels + media). |
| `/media/:id` | Streams a local file (add `?transcode=1` to force transcoding). |
| `/channel/:id` | Streams an always-on loop channel. |
| `/api/channels` | JSON channel list (used by the web player). |
| `/api/rescan` | `POST` to re-scan the media folder now. |
| `/api/health` | Status check. |

---

## Running it permanently

`install/setup.sh` can install a **launchd** agent
(`~/Library/LaunchAgents/com.iptvserver.plist`) that starts the server at login
and restarts it if it crashes.

- View logs: `tail -f iptv-server.log`
- Stop: `launchctl unload ~/Library/LaunchAgents/com.iptvserver.plist`
- Start: `launchctl load ~/Library/LaunchAgents/com.iptvserver.plist`

To avoid the Mac sleeping (which would stop streaming), in **System Settings →
Energy/Battery** set *"Prevent automatic sleeping when the display is off"* (or
run the server under `caffeinate`).

---

## Notes & legal

- This server only **aggregates** the publicly available Free-TV/IPTV list and
  your own files. It hosts no channels itself. Channel availability and legality
  depend on the upstream sources; some channels may be geo-blocked.
- Keep this on your **local network**. Don't expose port `8409` to the public
  internet without putting authentication / a reverse proxy in front of it.
- ffmpeg transcoding uses CPU. A Mac mini handles a couple of simultaneous
  transcodes comfortably; direct-play (`.mp4`) streams use almost none.
