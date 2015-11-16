var Play = require('../lib/play');

var play = new Play();

play.on("progress", function onProgress(percent) {
  console.log("progress", percent);
});

play.sound("../wavs/drums/kick.wav", function(error) {
  if (error) {
    console.error(error);
    return;
  }
});
