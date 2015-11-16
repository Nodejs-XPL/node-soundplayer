/*jslint node: true, vars: true, nomen: true*/
'use strict';

var UUID = require('uuid');
var events = require('events');

var Url = require('url');
var http = require('http');
var https = require('https');
var Path = require('path');
var fs = require('fs');
var child_p = require('child_process');
var events = require('events');
var util = require('util');
var mime = require('mime');
var debug = require('debug')('play.js:sound');

var playerPath = process.env.PLAYER_PATH || "";

function Sound(player, url, uuid) {
  this.player = player;
  this.url = url;
  this.uuid = uuid || UUID.v4();
}

// initialize and inherit
util.inherits(Sound, events.EventEmitter);

module.exports = Sound;

Sound.prototype.play = function(callback) {
  var self = this;

  this._getStream(function(error, streamInfos) {
    if (error) {
      return callback(error);
    }

    self._exec(streamInfos, function(error) {
      if (error) {
        return callback(error);
      }

      callback();
    });
  });
};

Sound.prototype._getStream = function(callback) {
  var url = this.url;

  if (/^http:/.exec(url)) {
    var httpOptions = Url.parse(url);

    var request = http.get(httpOptions, function(resp) {
      debug("Read http stream", url, resp, request);

      var contentType = response.getHeader('content-type');

      callback(null, {
        stream : resp,
        contentType : contentType
      });
    });

    request.on("error", function(e) {
      callback(e);
    });
    return;
  }

  if (/^https:/.exec(url)) {
    var httpOptions = Url.parse(url);

    var request = https.get(httpOptions, function(resp) {
      debug("Read https stream", url, resp, request);

      var contentType = response.getHeader('content-type');

      callback(null, {
        stream : resp,
        contentType : contentType
      });
    });

    request.on("error", function(e) {
      callback(e);
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

    debug("Read file: stream", url, p); // , stream);

    callback(null, {
      stream : stream,
      contentType : mimeType
    });
    return;
  }

  var stream = fs.createReadStream(url, {
    flags : 'r',
    autoClose : true
  });

  callback(null, {
    stream : stream,
    contentType : mimeType
  });
};

Sound.prototype._exec = function(streamInfos, callback) {
  debug("Playing ", streamInfos);

  var self = this;

  this.player.findPlayer(function(error, player) {
    if (error) {
      return callback(error);
    }

    var type = "mp3";
    switch (streamInfos.contentType) {
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

    self.emit("playing");

    var playerExe = player.name;
    if (self.playerPath) {
      playerExe = Path.join(self.playerPath, playerExe);
    }

    debug("Spawn ", playerExe, args);

    var playerProcess = child_p.spawn(playerExe, args, {
      stdio : [ 'pipe', 'pipe', 'pipe' ]
    });

    if (!playerProcess) {
      var error = new Error("Can not spawn player '" + self.playerName + "'");

      self.emit("error");
      return callback(error);
    }

    self.playerProcess = playerProcess;

    function scanProgress(data) {
      var ds = String(data).split('\r');
      ds.forEach(function(d) {
        d = d.replace(/\s+/g, ' ');
        // console.log('stdout: ' + d);
        var progress = self._processProgress(d);
        if (!progress) {
          return;
        }

        self.progress = progress;

        self.emit("progress", progress);
      });
    }

    playerProcess.stdout.on('data', scanProgress);
    playerProcess.stderr.on('data', scanProgress);

    playerProcess.on("exit", function() {
      debug("Emit: player:stopped", url);
      self.emit("stopped");
      delete self.playerProcess;
      callback();
    });
    playerProcess.on("error", function(error) {
      debug("Emit: player:error", url, error);
      self.emit("error", error);
      delete self.playerProcess;

      callback(error);
    });

    stream.on('data', function(chunk) {
      // debug("Read chunk ", chunk);
      playerProcess.stdin.write(chunk);
    });

    stream.on('end', function(chunk) {
      // debug("End chunk ", chunk);
      if (chunk) {
        playerProcess.stdin.write(chunk);
      }

      playerProcess.stdin.end();
    });
  });
}

Sound.prototype._processProgress = function(d) {

  var playRegExp = /^In:([0-9\.]+)% ([0-9]{2}):([0-9]{2}):([0-9\.]{5,6}) \[([0-9]{2}):([0-9]{2}):([0-9\.]{5,6})\]/
      .exec(d);
  debug("PlayRegExp=", playRegExp);
  if (playRegExp) {
    var percent = parseFloat(playRegExp[1]);
    var offset = parseInt(playRegExp[2], 10);
    offset = offset * 60 + parseInt(playRegExp[3], 10);
    offset = offset * 60 + parseFloat(playRegExp[4]);

    var left = parseInt(playRegExp[5], 10);
    left = left * 60 + parseInt(playRegExp[6], 10);
    left = left * 60 + parseFloat(playRegExp[7]);

    return {
      percent : percent,
      offset : offset,
      left : left
    };
  }

  return null;
}
