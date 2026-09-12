const fs = require("fs");
const player = require("play-sound")();
const readline = require("readline");
const chalk = require("chalk").default;
const boxen = require("boxen").default;

// ── Helpers ──────────────────────────────────────────────────────────────────

function box(text, opts) {
  return boxen(text, { padding: { left: 2, right: 2, top: 0, bottom: 0 }, borderStyle: "round", ...opts });
}

function header() {
  console.clear();
  console.log(box(
    chalk.bold.hex("#FF6AC1")("AKO-N-BEATS") + "\n" + chalk.gray("Terminal Music Player"),
    { borderColor: "magenta", textAlignment: "center" }
  ));
}

// ── Startup ───────────────────────────────────────────────────────────────────

header();

const songs = fs.readdirSync("./music").filter(f => f.endsWith(".mp3"));

const songList = songs
  .map((s, i) => `  ${chalk.hex("#FF6AC1").bold(i + 1 + ".")} ${chalk.white(s.replace(".mp3", ""))}`)
  .join("\n");

console.log(box(chalk.bold.cyan("Available Songs") + "\n\n" + songList, { borderColor: "cyan" }));

// ── Song Selection ────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question(chalk.yellow("\n  Enter song number: "), (answer) => {
  rl.close();

  const choice = Number(answer) - 1;

  if (choice < 0 || choice >= songs.length) {
    console.log(chalk.red("\n  ✖ Invalid song number.\n"));
    process.exit(0);
  }

  const song = songs[choice];
  const songName = song.replace(".mp3", "");
  let currentAudio = null;
  let state = "stopped";

  const controls = chalk.gray("[p]") + " pause/resume  " + chalk.gray("[s]") + " stop  " + chalk.gray("[q]") + " quit";

  function printStatus(icon, message, color) {
    console.log("\n" + box(
      chalk[color].bold(icon + "  " + message) + "\n" + chalk.gray(controls),
      { borderColor: color }
    ) + "\n");
  }

  function playSong() {
    printStatus("▶", "Now Playing: " + songName, "green");

    currentAudio = player.play(`./music/${song}`, (err) => {
      if (err && state === "playing") console.log(chalk.red("  ✖ Could not play the song."));
      if (state === "playing") state = "stopped";
    });
    state = "playing";
  }

  playSong();

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (key) => {
    if (key === "p") {
      if (state === "playing") {
        currentAudio.kill("SIGSTOP");
        state = "paused";
        printStatus("⏸", "Paused: " + songName, "yellow");
      } else if (state === "paused") {
        currentAudio.kill("SIGCONT");
        state = "playing";
        printStatus("▶", "Resumed: " + songName, "green");
      } else {
        console.log(chalk.gray("\n  Nothing is playing.\n"));
      }
    } else if (key === "s") {
      if (state === "playing" || state === "paused") {
        if (state === "paused") currentAudio.kill("SIGCONT");
        currentAudio.kill("SIGKILL");
        state = "stopped";
        printStatus("⏹", "Stopped: " + songName, "red");
      } else {
        console.log(chalk.gray("\n  Nothing is playing.\n"));
      }
    } else if (key === "q") {
      if (state === "paused") currentAudio.kill("SIGCONT");
      if (state !== "stopped") currentAudio.kill("SIGKILL");
      console.log("\n" + box(chalk.magenta.bold("Thanks for listening! Goodbye 👋"), { borderColor: "magenta", textAlignment: "center" }) + "\n");
      process.exit(0);
    }
  });
});
