var play = require('../lib/play');

var p = play.sound("L_appel.mp3", function(error) {
  if (error) {
    console.error(error);
    return;
  }
});

p.on("progress", function onProgress(percent) {
  console.log("progress", percent);
});
