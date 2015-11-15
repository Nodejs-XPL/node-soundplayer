var Play = require('../lib/play');

var play=new Play();

var p = play.sound("../wavs/drums/kick.wav", function(error) {
  if (error) {
    console.error(error);
    return;
  }
});

p.on("progress", function onProgress(percent) {
  console.log("progress", percent);
});
