var Path = require('path');
var Play = require('../lib/play');

var play = new Play();

play.on("progress", function onProgress(percent) {
  console.log("progress", percent);
});

var path = Path.join(__dirname, "../wavs/mp3/L_appel.mp3");

console.log("Play ", path);
play.sound(path, function(error) {
  if (error) {
    console.error(error);
    return;
  }
});
