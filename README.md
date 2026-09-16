# AKO-N-BEATS ⚡

A high-fidelity, keyboard-driven terminal music player for local audio tracks with rich ANSI styling, automatic queue progression, shuffle mode, and metadata inspection.

---

## 🚀 Features

- **Next / Previous Track Controls:** Skip or backtrack through your playlist instantly with `n`/`b` or Arrow keys.
- **Continuous Auto-Play Queue:** Automatically transitions to the next track when a song finishes playing.
- **ANSI Color Styling & Banner:** Vibrant neon ASCII banner and modern boxed cards for playback status, playlist overview, and HUD badges.
- **Shuffle & Loop Modes:** Seamlessly toggle non-repeating shuffle mode (`r`) and cycle playlist / single track loop modes (`l`).
- **Track Duration & Metadata Parsing:** Powered by `music-metadata` to extract Title, Artist, Album, Bitrate, and Duration for tracks.
- **Direct Track Jump:** Press number keys `1`–`9` to jump directly to any track in your playlist.
- **Broad Format Support:** Plays MP3, WAV, M4A, AAC, AIFF, CAF, FLAC, and OGG audio files.

---

## 📋 Requirements

- **Node.js** (v18+)
- **macOS** / Unix-compatible audio player backend (`afplay` / `play-sound`)

---

## 🛠 Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Shailja-Vatsa/AKO-N-BEATS.git
cd AKO-N-BEATS
npm install
```

---

## 🎵 Usage

Drop your audio files into the `./music/` directory, then start the player:

```bash
npm start
```

On startup, AKO-N-BEATS will scan `./music/`, parse metadata, and display the tracklist. You can enter a song number or press `ENTER` to begin continuous playback from the start.

---

## ⌨️ Interactive Controls

| Key | Action | Description |
|---|---|---|
| `p` / `Space` | **Pause / Resume** | Toggle playback pause or resume current track |
| `n` / `→` | **Next Track** | Skip forward to next track in queue |
| `b` / `←` | **Previous Track** | Skip backward to previous track |
| `s` | **Stop** | Stop audio playback |
| `r` | **Shuffle** | Toggle shuffle mode ON / OFF |
| `l` | **Loop Mode** | Cycle through `LOOP: ALL` ➔ `LOOP: ONE` ➔ `LOOP: OFF` |
| `1`–`9` | **Quick Jump** | Jump directly to track #1 through #9 |
| `q` / `Ctrl+C` | **Quit** | Gracefully terminate audio and exit |

---

## 📁 Project Structure

```
AKO-N-BEATS/
├── music/        # Audio files (.mp3, .wav, .m4a, .aac, .flac, etc.)
├── src/
│   └── index.js  # Main application logic & playback engine
├── package.json
└── README.md
```
