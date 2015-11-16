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
var debug = require('debug')('play.js');
var mime = require('mime');
var Path = require('path');

var playerList = [ {
  name : 'afplay'
}, {
  name : 'mpg123',
  args : [ '-v', '-' ]
}, {
  name : 'mpg321',
  args : [ '-v', '-' ]
}, {
  name : 'play',
  args : [ '-t', '%TYPE%' ]
}, {
  name : 'omxplayer',
  args : []
} ];

// play is this
function Play(configuration) {
  var self = this;

  if (!(this instanceof Play)) {
    return new Play(configuration);
  }

  configuration = configuration || {};

  events.EventEmitter.call(this);

  this.configuration = configuration;
  this.playerName = null;
  this.player = null;
}

// initialize and inherit
util.inherits(Play, events.EventEmitter);

Play.prototype.findPlayer = function(callback) {
  if (this.player) {
    debug("Player already known: " + this.player.name);
    return callback(null, this.player.name, this.player);
  }
  // a hack to check if we have any players available

  var playerPath = process.env.PLAYER_PATH || "";

  var self = this;
  async.eachSeries(playerList, function(player, callback) {
    if (self.player) {
      debug("Ignore player", player);
      return callback();
    }
    debug("Try player", player.name);

    var playerExe = player.name;
    if (playerPath) {
      playerExe = Path.join(playerPath, playerExe);
    }

    child_p.exec(player.name, function(error, stdout, stderr) {
      debug("Return of ", player.name, "error=", error, "stdout=", stdout,
          "stderr=", stderr);

      if (error === null || error.code !== 127) {
        debug("Select player", player.name);
        // if the command was successful
        self.playerName = player.name;
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
      self.emit('checked', self.player.name, self.player);
    }

    callback(null, self.player.name, self.player);
  });
};

//
// Allows the user to manually set a player name
//
Play.prototype.usePlayer = function usePlayer(name) {
  for (var i = 0; i < playerList.length; i++) {
    var player = playerList[i];

    if (player.name !== name) {
      continue;
    }

    this.playerName = name;
    this.player = player;
    return true;
  }

  return false;
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

  function playing(stream, mimeType) {
    debug("Playing ", stream, " MimeType=", mimeType);
    self
        .findPlayer(function(error, playerName, player) {
          if (error) {
            return callback(error);
          }

          var type = "mp3";
          switch (mimeType) {
          case "audio/wave":
          case "audio/wav":
          case "audio/x-wav":
          case "audio/x-pn-wav":
            type = "wav"
            break;
          case "audio/flac":
            type = "flac"
            break;
          case "audio/ogg":
            type = "ogg"
            break;

          }

          var args = (player.args || []).slice(0);
          for (var i = 0; i < args.length; i++) {
            args[i] = args[i].replace('%TYPE%', type);
          }

          self.emit("playing", url, playerName);

          player = child_p.spawn(playerName, args, {
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
      debug("Read http stream", url, resp, request);

      var contentType = response.getHeader('content-type');

      playing(resp, contentType);
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
      debug("Read https stream", url, resp, request);

      var contentType = response.getHeader('content-type');

      playing(resp, contentType);
    });

    request.on("error", function(e) {
      callback(e);
      return;
    });
    return;
  }

  var mimeType = mime.lookup(url);

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

    debug("Read file: stream", url, p, stream);

    playing(stream, mimeType);
    return;
  }

  var stream = fs.createReadStream(url, {
    flags : 'r',
    autoClose : true
  });

  debug("Read stream", url, stream);

  playing(stream, mimeType);
}

module.exports = Play;