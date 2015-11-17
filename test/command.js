var Path = require('path');
var Player = require('../lib/player');

var player = new Player();

player.on("progress", function onProgress(percent) {
  console.log("progress", percent);
});

var path = process.argv[0];

console.log("Play ", path);
var sound = player.playSound(path, function(error) {
  if (error) {
    console.error(error);
    return;
  }
});

console.log("UUID of sound=" + sound.uuid);