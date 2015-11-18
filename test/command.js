var Path = require('path');
var Player = require('../lib/player');

var player = new Player();

var path = process.argv[1];

console.log("Play ", path);
var sound = player.playSound(path, function(error) {
  if (error) {
    console.error(error);
    return;
  }
});

sound.on("progress", function onProgress(percent) {
  console.log("progress", percent);
});

console.log("UUID of sound=" + sound.uuid);