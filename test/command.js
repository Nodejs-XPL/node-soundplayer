var Path = require('path');
var Player = require('../lib/player');
var commander = require('commander');

var player = new Player();

commander.command('*').description("Start playing").action(function(args) {

  console.log("Play ", args);
  var path = args[0];

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