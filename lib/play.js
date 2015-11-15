// play.js - Marak Squires
// MIT yo, copy paste us some credit

var child_p = require('child_process');
var async = require('async');
var events = require('events');
var util = require('util');
var Url = require('url');
var http = require('http');
var https = require('https');
var fs = require('fs');
var debug = require('debug');

var playerList = [ 'afplay', 'play', 'mplayer', 'mpg123', 'mpg321' ];

if (process.env.PLAYER_PATH) {
  playerList.unshift(process.env.PLAYER_PATH);
}

// play is this
function Play(configuration) {
  var self = this;

  if (!(this instanceof Play)) {
    return new Play(configuration);
  }

  configuration = configuration || {};

  events.EventEmitter.call(this);

  this.configuration = configuration;
  this.playerName = false;
}

Play.prototype.findPlayer = function(callback) {
  if (this.playerName) {
    debug("Player already known: " + this.playerName);
    return callback(null, this.playerName);
  }
  // a hack to check if we have any players available

  var self = this;
  async.eachSeries(this.playerList, function(playerName, callback) {
    if (self.playerName) {
      debug("Ignore player", playerName);
      return callback();
    }
    debug("Try player", playerName);

    child_p.exec(playerName, function(error, stdout, stderr) {
      debug("Return of ", playerName, "error=", error, "stdout=", stdout,
          "stderr=", stderr);

      if (error === null || error.code !== 127) {
        debug("Select player", playerName);
        // if the command was successful
        self.playerName = name;
        self.emit('checked', name);
        callback();
        return;
      }

      // Problem !?
      callback();
    });

  }, function(error) {
    if (error) {
      return callback(error);
    }

    callback(null, self.playerName);
  });
};

// initialize and inherit
util.inherits(Play, events.EventEmitter);

//
// Allows the user to manually set a player name
//
Play.prototype.usePlayer = function usePlayer(name) {
  this.playerName = name;
}

/**
 * Have the user player the file, with a callback when it ends
 * 
 * @returns {Promise};
 */
Play.prototype.sound = function playURL(url, callback) {

  var returned = false;
  var oldCallback = callback;
  callback = function(error) {
    if (returned || !oldCallback) {
      return;
    }
    returned = true;
    oldCallback(error);
  };

  var self = this;

  function playing(stream) {
    self
        .findPlayer(function(error, playerName) {
          if (error) {
            return callback(error);
          }

          self.emit("playing", url, playerName);

          var command = [ "-" ];
          player = child_p.spawn(playerName, command, {
            stdio : [ stream, 'pipe', 'pipe' ]
          });
          if (!player) {
            var error = new Error("Can not spawn player '" + self.playerName +
                "'");

            self.emit("error", url, error);
            return callback(error);
          }

          player.stdout.on('data', function(data) {
            console.log('stdout: ' + data);
          });

          player.stderr.on('data', function(data) {
            console.log('stderr: ' + data);
          });

          player.on("exit", function() {
            debug("Emit: player:stopped", url);
            self.emit("stopped", url);

            callback();
          });
          player.on("error", function(error) {
            debug("Emit: player:error", url, error);
            self.emit("error", url, error);

            callback(error);
          });
        });
  }

  if (/^http:/.exec(url)) {
    var httpOptions = Url.parse(url);

    var request = http.get(httpOptions, function(resp) {
      playing(resp);
    });

    request.on("error", function(e) {
      callback(e);
      return;
    });
    return;
  }
  if (/^https:/.exec(url)) {
    var httpOptions = Url.parse(url);

    var request = https.get(httpOptions, function(resp) {
      playing(resp);
    });

    request.on("error", function(e) {
      callback(e);
      return;
    });
    return;
  }

  var r = /^file:\/\/\/(.*)$/.exec(url);
  if (r) {
    var p = r[1];

    if (Path.sep === '\\') {
      p = p.replace(/\//g, '\\');
    }

    var stream = fs.createReadStream(p, {
      flags : 'r',
      autoClose : true
    });

    playing(stream);
    return;
  }

  var stream = fs.createReadStream(url, {
    flags : 'r',
    autoClose : true
  });

  playing(stream);
}

module.exports = Play;