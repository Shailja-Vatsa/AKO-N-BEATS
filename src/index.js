const fs = require("fs");
const path = require("path");
const player = require("play-sound")();
const readline = require("readline");

// Load ESM / CommonJS dependencies
let chalk;
let boxen;
let musicMetadata;

// Audio format support
const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".aiff", ".caf", ".flac", ".ogg"];

// ── State Management ──────────────────────────────────────────────────────────

const state = {
  tracks: [],          // Array of track objects { filename, filepath, title, artist, album, duration, durationFormatted, bitrate }
  queue: [],           // Array of indices into state.tracks representing playback order
  queuePosition: 0,    // Current position in state.queue
  currentAudio: null,  // Active audio process from play-sound
  playbackState: "idle", // 'playing' | 'paused' | 'stopped' | 'idle'
  isShuffle: false,
  loopMode: "ALL",     // 'ALL' | 'ONE' | 'OFF'
  isIntentionalStop: false, // Flag to prevent auto-play trigger when skipping/stopping
  activeTrackId: 0,    // Unique counter to discard stale process callbacks
};

// ── Helpers & Formatting ──────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatBitrate(bitrate) {
  if (!bitrate || isNaN(bitrate)) return null;
  return `${Math.round(bitrate / 1000)} kbps`;
}

function cleanTrackName(filename) {
  const ext = path.extname(filename);
  let name = path.basename(filename, ext);
  // Clean common web download tags if present
  name = name.replace(/\(chosic\.com\)/gi, "").replace(/_chosic\.com_/gi, "");
  name = name.replace(/[-_]+/g, " ").trim();
  return name;
}

function createBox(text, opts = {}) {
  return boxen(text, {
    padding: { left: 2, right: 2, top: 0, bottom: 0 },
    borderStyle: "round",
    ...opts,
  });
}

function renderBanner() {
  const banner = [
    "    ___    __ _____        _   __     ____  _______  ___________ ",
    "   /   |  / //_/ __ \\      / | / /    / __ )/ ____/   |/_  __/ ___/ ",
    "  / /| | / ,< / / / /_____/  |/ /____/ __  / __/ / /| | / /  \\__ \\  ",
    " / ___ |/ /| / /_/ /_____/ /|  /_____/ /_/ / /___/ ___ |/ /  ___/ / ",
    "/_/  |_/_/ |_|\\____/     /_/ |_/    /_____/_____/_/  |_/_/  /____/  ",
  ];

  const colors = ["#FF6AC1", "#F472B6", "#C084FC", "#818CF8", "#38BDF8"];
  const coloredBanner = banner
    .map((line, i) => chalk.hex(colors[i % colors.length]).bold(line))
    .join("\n");

  const subtitle = chalk.hex("#A78BFA").bold("⚡ HIGH-FIDELITY TERMINAL AUDIO ENGINE ⚡");
  const meta = chalk.gray("v2.0 • Lossless & Multi-Format • Keyboard Driven");

  console.clear();
  console.log(
    createBox(`${coloredBanner}\n\n${subtitle}\n${meta}`, {
      borderColor: "#FF6AC1",
      textAlignment: "center",
      padding: { top: 1, bottom: 1, left: 3, right: 3 },
    })
  );
}

// ── Metadata Loading ──────────────────────────────────────────────────────────

async function loadTracks() {
  const musicDir = path.resolve("./music");
  if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true });
  }

  const files = fs.readdirSync(musicDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  });

  const tracks = [];

  for (const file of files) {
    const filepath = path.join(musicDir, file);
    let title = cleanTrackName(file);
    let artist = "Unknown Artist";
    let album = "";
    let duration = 0;
    let bitrate = null;

    try {
      const metadata = await musicMetadata.parseFile(filepath);
      if (metadata.common.title && metadata.common.title.trim()) {
        title = metadata.common.title.trim();
      }
      if (metadata.common.artist && metadata.common.artist.trim()) {
        artist = metadata.common.artist.trim();
      }
      if (metadata.common.album && metadata.common.album.trim()) {
        album = metadata.common.album.trim();
      }
      if (metadata.format.duration) {
        duration = metadata.format.duration;
      }
      if (metadata.format.bitrate) {
        bitrate = metadata.format.bitrate;
      }
    } catch {
      // Fallback to defaults
    }

    tracks.push({
      filename: file,
      filepath,
      title,
      artist,
      album,
      duration,
      durationFormatted: formatDuration(duration),
      bitrateFormatted: formatBitrate(bitrate),
    });
  }

  return tracks;
}

// ── Queue & Shuffle Logic ────────────────────────────────────────────────────

function generateQueue(trackCount, isShuffle, currentTrackIndex = 0) {
  const indices = Array.from({ length: trackCount }, (_, i) => i);
  if (!isShuffle) {
    return { queue: indices, position: currentTrackIndex >= 0 ? currentTrackIndex : 0 };
  }

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Put currently active track first in shuffled queue if valid
  if (currentTrackIndex >= 0) {
    const pos = indices.indexOf(currentTrackIndex);
    if (pos > -1) {
      indices.splice(pos, 1);
      indices.unshift(currentTrackIndex);
    }
  }

  return { queue: indices, position: 0 };
}

function toggleShuffle() {
  const currentTrackIdx = getCurrentTrackIndex();
  state.isShuffle = !state.isShuffle;

  const result = generateQueue(state.tracks.length, state.isShuffle, currentTrackIdx);
  state.queue = result.queue;
  state.queuePosition = result.position;

  renderHUD(`Shuffle ${state.isShuffle ? "Enabled" : "Disabled"}`);
}

function toggleLoopMode() {
  if (state.loopMode === "ALL") {
    state.loopMode = "ONE";
  } else if (state.loopMode === "ONE") {
    state.loopMode = "OFF";
  } else {
    state.loopMode = "ALL";
  }
  renderHUD(`Loop Mode: ${state.loopMode}`);
}

function getCurrentTrackIndex() {
  if (!state.queue || state.queue.length === 0) return 0;
  return state.queue[state.queuePosition] ?? 0;
}

function getCurrentTrack() {
  const idx = getCurrentTrackIndex();
  return state.tracks[idx];
}

// ── UI Rendering ─────────────────────────────────────────────────────────────

function renderPlaylistTable() {
  if (state.tracks.length === 0) {
    console.log(
      createBox(chalk.yellow("⚠ No audio tracks found in ./music/\nDrop MP3/WAV/M4A files into the folder and restart."), {
        borderColor: "yellow",
        textAlignment: "center",
      })
    );
    return;
  }

  const currentIdx = getCurrentTrackIndex();

  const lines = state.tracks.map((t, idx) => {
    const isPlayingCurrent = idx === currentIdx && (state.playbackState === "playing" || state.playbackState === "paused");
    const num = chalk.bold.hex("#FF6AC1")(`${(idx + 1).toString().padStart(2, " ")}.`);
    const activeMarker = isPlayingCurrent ? chalk.green.bold("▶ ") : "  ";
    
    // Truncate strings to prevent terminal wrap
    const maxTitleLen = 32;
    const rawTitle = t.title.length > maxTitleLen ? t.title.substring(0, maxTitleLen - 3) + "..." : t.title;
    const title = isPlayingCurrent ? chalk.green.bold(rawTitle.padEnd(maxTitleLen, " ")) : chalk.white(rawTitle.padEnd(maxTitleLen, " "));

    const maxArtistLen = 22;
    const rawArtist = t.artist.length > maxArtistLen ? t.artist.substring(0, maxArtistLen - 3) + "..." : t.artist;
    const artist = chalk.hex("#94A3B8")(rawArtist.padEnd(maxArtistLen, " "));

    const duration = chalk.hex("#38BDF8")(t.durationFormatted.padStart(6, " "));

    return `${activeMarker}${num} ${title} ${artist} ${duration}`;
  });

  const header = `  ${chalk.gray("#")}  ${chalk.gray("TITLE".padEnd(32, " "))} ${chalk.gray("ARTIST".padEnd(22, " "))} ${chalk.gray("DURATION")}`;
  const divider = chalk.gray("─".repeat(68));

  console.log(
    createBox(`${chalk.bold.cyan("♫ TRACK PLAYLIST")}\n\n${header}\n${divider}\n${lines.join("\n")}`, {
      borderColor: "cyan",
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
    })
  );
}

function renderHUD(notification = "") {
  renderBanner();
  renderPlaylistTable();

  const currentTrack = getCurrentTrack();
  if (!currentTrack) return;

  // Status badges
  let statusBadge = chalk.bgGreen.black.bold(" ▶ PLAYING ");
  let borderColor = "green";

  if (state.playbackState === "paused") {
    statusBadge = chalk.bgYellow.black.bold(" ❚❚ PAUSED ");
    borderColor = "yellow";
  } else if (state.playbackState === "stopped") {
    statusBadge = chalk.bgRed.white.bold(" ■ STOPPED ");
    borderColor = "red";
  } else if (state.playbackState === "idle") {
    statusBadge = chalk.bgGray.white.bold(" ● READY ");
    borderColor = "magenta";
  }

  const shuffleBadge = state.isShuffle
    ? chalk.bgHex("#9333EA").white.bold(" 🔀 SHUFFLE: ON ")
    : chalk.hex("#64748B")(" 🔀 SHUFFLE: OFF ");

  const loopBadge =
    state.loopMode === "ALL"
      ? chalk.bgHex("#2563EB").white.bold(" 🔁 LOOP: ALL ")
      : state.loopMode === "ONE"
      ? chalk.bgHex("#0D9488").white.bold(" 🔂 LOOP: ONE ")
      : chalk.hex("#64748B")(" 🔁 LOOP: OFF ");

  const queueBadge = chalk.hex("#F472B6").bold(`[${state.queuePosition + 1}/${state.tracks.length}]`);

  const badges = `${statusBadge}  ${shuffleBadge}  ${loopBadge}  ${queueBadge}`;

  // Track details card
  const titleLine = `${chalk.bold.white("Title:   ")} ${chalk.bold.hex("#F43F5E")(currentTrack.title)}`;
  const artistLine = `${chalk.bold.white("Artist:  ")} ${chalk.hex("#CBD5E1")(currentTrack.artist)}`;
  const durationLine = `${chalk.bold.white("Length:  ")} ${chalk.hex("#38BDF8")(currentTrack.durationFormatted)}${
    currentTrack.bitrateFormatted ? chalk.gray(`  •  ${currentTrack.bitrateFormatted}`) : ""
  }`;
  const fileLine = `${chalk.bold.white("File:    ")} ${chalk.gray(currentTrack.filename)}`;

  const trackInfo = `${titleLine}\n${artistLine}\n${durationLine}\n${fileLine}`;

  // Interactive controls guide
  const controlsHeader = `${chalk.bold.cyan("⌨️  KEYBOARD CONTROLS")}  ${chalk.gray("(Press key directly • No ENTER needed)")}`;
  const divider = chalk.gray("─".repeat(68));

  const cP = chalk.hex("#F59E0B").bold("[p / Space]".padEnd(11, " "));
  const cN = chalk.hex("#10B981").bold("[n / →]".padEnd(11, " "));
  const cS = chalk.hex("#EF4444").bold("[s]".padEnd(11, " "));
  const cB = chalk.hex("#10B981").bold("[b / ←]".padEnd(11, " "));
  const cR = chalk.hex("#A855F7").bold("[r]".padEnd(11, " "));
  const cL = chalk.hex("#3B82F6").bold("[l]".padEnd(11, " "));
  const cJ = chalk.hex("#38BDF8").bold("[1-9]".padEnd(11, " "));
  const cQ = chalk.hex("#EC4899").bold("[q]".padEnd(11, " "));

  const row1 = `  ${cP} ${chalk.white("Pause / Resume".padEnd(20, " "))} ${cN} ${chalk.white("Next Song")}`;
  const row2 = `  ${cS} ${chalk.white("Stop Playback".padEnd(20, " "))} ${cB} ${chalk.white("Previous Song")}`;
  const row3 = `  ${cR} ${chalk.white("Toggle Shuffle".padEnd(20, " "))} ${cL} ${chalk.white("Cycle Loop Mode")}`;
  const row4 = `  ${cJ} ${chalk.white("Jump to Track #".padEnd(20, " "))} ${cQ} ${chalk.white("Quit / Exit")}`;

  const controlsBlock = `${controlsHeader}\n${divider}\n${row1}\n${row2}\n${row3}\n${row4}`;

  let noticeBlock = "";
  if (notification) {
    noticeBlock = `\n\n${chalk.hex("#FDE047").italic(`⚡ ${notification}`)}`;
  }

  const hudContent = `${badges}\n\n${trackInfo}\n\n${controlsBlock}${noticeBlock}`;

  console.log(
    createBox(hudContent, {
      borderColor,
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
    })
  );
}

// ── Playback Engine ──────────────────────────────────────────────────────────

function stopCurrentAudio() {
  state.isIntentionalStop = true;
  state.activeTrackId++; // Invalidate pending callbacks from previous process

  if (state.currentAudio) {
    const audioProc = state.currentAudio;
    state.currentAudio = null;
    try {
      if (state.playbackState === "paused") {
        audioProc.kill("SIGCONT");
      }
      audioProc.kill("SIGKILL");
    } catch {
      // Process already terminated
    }
  }
}

function playTrack(queueIndex, notification = "") {
  if (state.tracks.length === 0) return;

  // Bound index safely
  if (queueIndex < 0) queueIndex = 0;
  if (queueIndex >= state.queue.length) queueIndex = 0;

  state.queuePosition = queueIndex;
  const track = getCurrentTrack();
  if (!track) return;

  stopCurrentAudio();
  state.isIntentionalStop = false;
  state.playbackState = "playing";

  const trackSessionId = state.activeTrackId;

  state.currentAudio = player.play(track.filepath, (err) => {
    // Discard callback if not matching current active session or was explicitly stopped/skipped
    if (state.activeTrackId !== trackSessionId || state.isIntentionalStop) {
      return;
    }

    if (err) {
      state.playbackState = "stopped";
      renderHUD(`Playback error: ${err.message || "Could not play file"}`);
      return;
    }

    // Natural track completion -> Auto-Play Next
    handleTrackCompletion();
  });

  renderHUD(notification || `Now Playing: ${track.title}`);
}

function handleTrackCompletion() {
  if (state.loopMode === "ONE") {
    // Replay same track
    playTrack(state.queuePosition, `Repeating track (${getCurrentTrack().title})`);
    return;
  }

  const nextPos = state.queuePosition + 1;

  if (nextPos < state.queue.length) {
    // Next track in queue
    playTrack(nextPos, "Auto-playing next track");
  } else {
    // Reached end of queue
    if (state.loopMode === "ALL") {
      // Loop back to start
      playTrack(0, "Queue finished • Looping back to start");
    } else {
      // End playback
      state.playbackState = "stopped";
      renderHUD("Queue completed.");
    }
  }
}

function nextTrack() {
  if (state.tracks.length === 0) return;
  const nextPos = state.queuePosition + 1;
  if (nextPos < state.queue.length) {
    playTrack(nextPos, "Skipped to next track");
  } else if (state.loopMode === "ALL") {
    playTrack(0, "Wrapped to first track");
  } else {
    renderHUD("End of queue reached.");
  }
}

function prevTrack() {
  if (state.tracks.length === 0) return;
  const prevPos = state.queuePosition - 1;
  if (prevPos >= 0) {
    playTrack(prevPos, "Returned to previous track");
  } else if (state.loopMode === "ALL") {
    playTrack(state.queue.length - 1, "Wrapped to last track");
  } else {
    renderHUD("Already at first track.");
  }
}

function togglePause() {
  if (!state.currentAudio || state.playbackState === "stopped" || state.playbackState === "idle") {
    // If stopped/idle, start playing current track
    playTrack(state.queuePosition);
    return;
  }

  if (state.playbackState === "playing") {
    try {
      state.currentAudio.kill("SIGSTOP");
      state.playbackState = "paused";
      renderHUD("Paused");
    } catch {
      state.playbackState = "stopped";
      renderHUD("Could not pause");
    }
  } else if (state.playbackState === "paused") {
    try {
      state.currentAudio.kill("SIGCONT");
      state.playbackState = "playing";
      renderHUD("Resumed");
    } catch {
      playTrack(state.queuePosition);
    }
  }
}

function stopPlayback() {
  if (state.playbackState !== "stopped" && state.playbackState !== "idle") {
    stopCurrentAudio();
    state.playbackState = "stopped";
    renderHUD("Playback stopped");
  }
}

function quitPlayer() {
  stopCurrentAudio();
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
    } catch {}
  }
  process.stdin.pause();
  console.clear();
  console.log(
    "\n" +
      createBox(
        `${chalk.hex("#FF6AC1").bold("Thanks for listening to AKO-N-BEATS!")}\n${chalk.gray(
          "Have a melodious day! 🎧 👋"
        )}`,
        {
          borderColor: "#FF6AC1",
          textAlignment: "center",
          padding: { top: 1, bottom: 1, left: 4, right: 4 },
        }
      ) +
      "\n"
  );
  process.exit(0);
}

// ── User Input & Keyboard Handling ───────────────────────────────────────────

function handleSingleKey(key) {
  // Handle Ctrl+C or 'q'
  if (key === "\u0003" || key === "q" || key === "Q") {
    quitPlayer();
    return;
  }

  switch (key) {
    case "p":
    case "P":
    case " ": // Spacebar
      togglePause();
      break;

    case "n":
    case "N":
    case "\u001b[C": // Right arrow
      nextTrack();
      break;

    case "b":
    case "B":
    case "\u001b[D": // Left arrow
      prevTrack();
      break;

    case "s":
    case "S":
      stopPlayback();
      break;

    case "r":
    case "R":
      toggleShuffle();
      break;

    case "l":
    case "L":
      toggleLoopMode();
      break;

    default:
      // Jump directly to track 1-9
      if (/^[1-9]$/.test(key)) {
        const targetTrackIdx = Number(key) - 1;
        if (targetTrackIdx < state.tracks.length) {
          const pos = state.queue.indexOf(targetTrackIdx);
          playTrack(pos >= 0 ? pos : targetTrackIdx, `Jumped to track #${key}`);
        }
      }
      break;
  }
}

function setupKeyboardControls() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (chunk) => {
    const str = chunk.toString();
    // Arrow keys or escape sequences
    if (str.startsWith("\u001b")) {
      handleSingleKey(str);
    } else {
      // Process individual key characters
      for (const ch of str) {
        handleSingleKey(ch);
      }
    }
  });

  process.on("exit", () => {
    stopCurrentAudio();
  });
  process.on("SIGINT", () => {
    quitPlayer();
  });
  process.on("SIGTERM", () => {
    quitPlayer();
  });
}

// ── Main Initialization ───────────────────────────────────────────────────────

async function main() {
  // Dynamically load ESM modules
  chalk = (await import("chalk")).default;
  boxen = (await import("boxen")).default;
  musicMetadata = await import("music-metadata");

  renderBanner();
  console.log(chalk.hex("#38BDF8")("\n  Scanning ./music/ directory and reading metadata...\n"));

  state.tracks = await loadTracks();

  if (state.tracks.length === 0) {
    renderBanner();
    renderPlaylistTable();
    console.log(chalk.yellow("\n  Add audio files to ./music/ and restart AKO-N-BEATS.\n"));
    process.exit(0);
  }

  const initialQueue = generateQueue(state.tracks.length, false, 0);
  state.queue = initialQueue.queue;
  state.queuePosition = initialQueue.position;

  renderBanner();
  renderPlaylistTable();

  console.log(
    chalk.hex("#94A3B8")(
      "\n  " + chalk.bold.yellow("💡 How to Start:") +
      "\n  • Type a track number " + chalk.hex("#FF6AC1").bold("[1-" + state.tracks.length + "]") + " and press " + chalk.bold.white("ENTER") + " to play a specific song" +
      "\n  • Or simply press " + chalk.bold.white("ENTER") + " to start playing all songs in order" +
      "\n  • During playback, all hotkeys respond " + chalk.bold.green("instantly") + " (no ENTER needed)\n"
    )
  );

  // Prompt user for initial choice or start automatically
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(
    chalk.yellow(`  Select track [1-${state.tracks.length}] or press [ENTER] to play all: `),
    (answer) => {
      rl.close();

      let startIndex = 0;
      const parsed = parseInt(answer.trim(), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= state.tracks.length) {
        startIndex = parsed - 1;
      }

      setupKeyboardControls();
      playTrack(startIndex);
    }
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
