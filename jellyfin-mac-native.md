# Jellyfin on macOS — native app (no Docker, no Terminal)

The simplest path: install Jellyfin as a normal Mac app, configure it in your
browser (Brave), and install the Jellyfin app on your TVs. Streams your local
media **and** live channels, with channel-changing on the TV.

## 1. Download (in Brave)

Go to **<https://jellyfin.org/downloads>** → **macOS**, or directly to the
releases: **<https://github.com/jellyfin/jellyfin-server-macos/releases>**

Pick the right `.dmg` for your Mac:
- **Apple Silicon (M1/M2/M3/M4):** the **arm64** dmg
- **Intel:** the **amd64 / x86_64** dmg

Not sure which? Apple menu  → **About This Mac**. "Chip: Apple M…" = arm64;
"Processor: Intel…" = amd64.

## 2. Install

1. Open the downloaded `.dmg`.
2. Drag **Jellyfin** into the **Applications** folder.
3. Launch it from Applications. First launch macOS may warn it's from the
   internet — if blocked, go **System Settings → Privacy & Security**, scroll to
   the Jellyfin message, and click **Open Anyway** (or right-click the app →
   **Open**).
4. Jellyfin runs as a **menu-bar icon** (top-right). It started a local server.
   Click the icon → it offers to open the dashboard, or just open Brave to:
   **http://localhost:8096**
5. In the menu-bar icon's options, enable **Start at Login** so it's always
   running for the TVs.

## 3. First-run setup (in Brave, http://localhost:8096)

1. Pick language → **Next**.
2. Create your **admin user + password** (remember these — the TVs use them).
3. **Add Media Library:**
   - Content type: **Movies** (or Shows / Mixed)
   - Folders → **Add** → choose **`/Users/miller/Videos`**
   - Finish. (macOS may ask permission for Jellyfin to access that folder —
     allow it.)
4. Finish the wizard.

## 4. Add Live TV (Free-TV channels)

Dashboard (☰ → Administration → Dashboard) → **Live TV**:

1. **Tuner Devices → +**
   - Type: **M3U Tuner**
   - URL: `https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8`
   - Save.
2. **TV Guide Data Providers → + → XMLTV**
   - URL (US): `https://epgshare01.online/epgshare01/epg_ripper_US1.xml.gz`
     (UK: `..._UK1.xml.gz`, Canada: `..._CA1.xml.gz`, etc.)
   - Save.
3. Let it refresh guide data. Under **Live TV** you'll get a channel grid.

> The raw Free-TV list has ~1,900 channels and some are dead/geo-blocked. You can
> tidy this later — in Live TV settings you can hide channels, or favorite the
> ones that work so they sort to the top. (If it gets annoying, we can add the
> Threadfin filter back.)

## 5. Keep the Mac serving

- Leave the Jellyfin menu-bar app running (Start at Login, step 2.5).
- **System Settings → Displays / Battery → prevent the Mac from sleeping** when
  the display is off, so streams don't drop.

## 6. Install the TV apps

- **Fire TV:** Appstore → **Jellyfin** → install. Open it; sign in to
  `http://192.168.4.24:8096` (or let it auto-discover on the LAN) with the admin
  user you made.
- **LG webOS:** LG Content Store → **Jellyfin** → install → same sign-in.
- Change channels in the **Live TV** guide with the remote; browse your movies
  under the library.

> Find your Mac's IP: System Settings → Network (it was `192.168.4.24`). Reserve
> it in your router so it never changes.

## Why this is nicer than the Docker route on a Mac

The native app uses Apple's **VideoToolbox** for hardware-accelerated
transcoding, so playback is smoother and lighter on the CPU than Docker (which is
CPU-only on macOS).
