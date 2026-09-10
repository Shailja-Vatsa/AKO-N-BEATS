const fs = require("fs");
const player = require("play-sound")();
const readline = require("readline");

console.log("AKO-N-BEATS");
console.log("Terminal Music Player");

const songs = fs.readdirSync("./music").filter(f => f.endsWith(".mp3"));

console.log("\nAvailable Songs:");
songs.forEach((song, index) => {
  console.log(`${index + 1}. ${song.replace(".mp3", "")}`);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("\nEnter song number: ", (answer) => {
  rl.close();

  const choice = Number(answer) - 1;

  if (choice < 0 || choice >= songs.length) {
    console.log("Invalid song number.");
    process.exit(0);
  }

  const song = songs[choice];
  let currentAudio = null;
  // state: 'stopped' | 'playing' | 'paused'
  let state = "stopped";

  function playSong() {
    console.log(`\n▶ Now Playing: ${song.replace(".mp3", "")}`);
    console.log("Controls: [p] pause/resume  [s] stop  [q] quit\n");

    currentAudio = player.play(`./music/${song}`, (err) => {
      if (err && state === "playing") console.log("Could not play the song.");
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
        console.log("⏸ Paused.");
      } else if (state === "paused") {
        currentAudio.kill("SIGCONT");
        state = "playing";
        console.log("▶ Resumed.");
      } else {
        console.log("Nothing is playing. Press [r] to restart.");
      }
    } else if (key === "s") {
      if (state === "playing" || state === "paused") {
        if (state === "paused") currentAudio.kill("SIGCONT");
        currentAudio.kill("SIGKILL");
        state = "stopped";
        console.log("⏹ Stopped.");
      } else {
        console.log("Nothing is playing.");
      }
    } else if (key === "q") {
      if (state === "paused") currentAudio.kill("SIGCONT");
      if (state !== "stopped") currentAudio.kill("SIGKILL");
      console.log("Goodbye!");
      process.exit(0);
    }
  });
});
