var Path = require('path');
var Player = require('../lib/player');

var commander;
try {
  commander = require('commander');
} catch (x) {
  console.error("You must install commander to use this test !");
}

var player = new Player();

commander.command('*').description("Play a song").action(function(path) {

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
});

commander.parse(process.argv);
