const fs = require("fs");

console.log("AKO-N-BEATS");
console.log("Terminal Music Player");

const songs = fs.readdirSync("./music");

console.log("\nAvailable Songs:");

songs.forEach((song, index) => {
  console.log(`${index + 1}. ${song.replace(".mp3", "")}`);
});