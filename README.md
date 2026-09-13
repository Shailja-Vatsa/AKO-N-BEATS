# AKO-N-BEATS

A lightweight command-line music player to play local audio tracks directly from your terminal.

---

## Features

- **Lightweight & Fast:** Minimal resource overhead with instant playback.
- **Terminal-Based UI:** Navigate and manage music without leaving your terminal.
- **Keyboard Controls:** Pause, resume, stop, and quit without pressing ENTER.
- **Broad Format Support:** Plays MP3, WAV, M4A, AAC, AIFF, and CAF audio files.

---

## Requirements

- Node.js
- macOS (uses `afplay` under the hood)

---

## Installation

Clone the repository to your local machine:

```bash
git clone https://github.com/Shailja-Vatsa/AKO-N-BEATS.git
cd AKO-N-BEATS
npm install
```

---

## Usage

Add your audio files to the `./music/` folder, then run:

```bash
npm start
```

You will see a numbered list of your songs. Type the song number and press ENTER to start playing.

---

## Controls

| Key | Action          |
|-----|-----------------|
| `p` | Pause / Resume  |
| `s` | Stop            |
| `q` | Quit            |

---

## Project Structure

```
AKO-N-BEATS/
├── music/        # Drop your .mp3 files here
├── src/
│   └── index.js  # Main entry point
└── package.json
```
