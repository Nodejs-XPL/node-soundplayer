/*jslint node: true, vars: true, nomen: true*/
'use strict';

var async = require('async');
var child_p = require('child_process');
var events = require('events');
var util = require('util');
var debug = require('debug')('soundplayer');

var Sound = require('./sound');

var playerList = [ {
  name : 'afplay',
  testArgs : "--version"
}, {
  name : 'play',
  testArgs : "--version",
  args : [ '-t', '%TYPE%', '-' ]
}, {
  name : 'mpg123',
  testArgs : "--version",
  args : [ '-v', '-' ]
}, {
  name : 'mpg321',
  testArgs : "--version",
  args : [ '-v', '-' ]
}, {
  name : 'omxplayer',
  testArgs : "--version",
  args : []
} ];

// play is this
function Player(configuration) {
  var self = this;

  if (!(this instanceof Player)) {
    return new Player(configuration);
  }

  configuration = configuration || {};

  this.playerPath = configuration.playerPath || process.env.PLAYER_PATH || "";

  events.EventEmitter.call(this);

  this.configuration = configuration;
  this.player = null;
}

// initialize and inherit
util.inherits(Player, events.EventEmitter);

Player.Sound = Sound;

Player.prototype.findPlayer = function(callback) {
  if (this.player) {
    debug("Player already known: " + this.player.name);
    return callback(null, this.player.name, this.player);
  }
  // a hack to check if we have any players available

  var self = this;
  async.eachSeries(playerList, function(player, callback) {
    if (self.player) {
      debug("Ignore player", player);
      return callback();
    }
    debug("Try player", player.name);

    var playerExe = player.name;
    if (self.playerPath) {
      playerExe = Path.join(self.playerPath, playerExe);
    }

    if (player.testArgs) {
      playerExe += " " + player.testArgs;
    }

    child_p.exec(playerExe, function(error, stdout, stderr) {
      if (stderr || error) {
        debug("Return of ", player.name, "error=", error, "stdout=", stdout,
            "stderr=", stderr);
      }

      if (error === null || error.code !== 127) {
        debug("Select player", player.name);
        // if the command was successful
        self.player = player;
        return callback();
      }

      // Problem !?
      callback();
    });

  }, function(error) {
    if (error) {
      return callback(error);
    }

    if (self.player) {
      self.emit('checked', self.player);
    }

    callback(null, self.player);
  });
};

//
// Allows the user to manually set a player name
//
Player.prototype.usePlayer = function usePlayer(name) {
  for (var i = 0; i < playerList.length; i++) {
    var player = playerList[i];

    if (player.name !== name) {
      continue;
    }

    this.player = player;
    return true;
  }

  return false;
}

/**
 * Have the user player the file, with a callback when it ends
 * 
 * @returns {Sound}
 */
Player.prototype.newSound = function newSound(url, uuid) {

  var sound = new Sound(this, url, uuid);

  return sound;
}

/**
 * Have the user player the file, with a callback when it ends
 * 
 * @returns {Sound}
 */
Player.prototype.playSound = function playSound(url, uuid, callback) {

  if (typeof (uuid) === "function") {
    callback = uuid;
    uuid = undefined;
  }

  var sound = this.newSound(url, uuid);

  setImmediate(function() {
    sound.play(callback || function(error) {
      if (error) {
        console.error(error);
      }
    });
  });

  this.emit("playSound", sound);

  return sound;
}

/**
 * Have the user player the file, with a callback when it ends
 * 
 * @returns {Sound}
 */
Player.prototype.sound = function playSound(url, callback) {
  return this.playSound(url, null, callback);
};

module.exports = Player;