var play = require('../lib/play');

var p = play.sound("../wavs/drums/kick.wav", function(error) {
  if (error) {
    console.error(error);
    return;
  }
});

p.on("progress", function onProgress(percent) {
  console.log("progress", percent);
});
