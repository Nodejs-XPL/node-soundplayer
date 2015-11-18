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
var debug = require('debug')('soundplayer:sound');

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

  this.player.findPlayer(function(error, player) {
    if (error) {
      return callback(error);
    }

    self._getStream(player, function(error, streamInfos) {
      if (error) {
        return callback(error);
      }

      self._exec(streamInfos, player, function(error) {
        if (error) {
          return callback(error);
        }

        callback();
      });
    });
  });
};

Sound.prototype._getStream = function(player, callback) {
  var url = this.url;

  if (/^http:/.exec(url)) {
    if (player.httpSupported) {
      return callback(null, {
        target : url
      });
    }
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
    if (player.httpsSupported) {
      return callback(null, {
        target : url
      });
    }

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

    if (player.fileSupported !== false) {
      return callback(null, {
        target : p
      });
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

  if (player.fileSupported !== false) {
    return callback(null, {
      target : url
    });
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

Sound.prototype._exec = function(streamInfos, player, callback) {
  debug("Playing ", streamInfos, player);

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

  var args;
  if (streamInfos.stream) {
    args = player.streamArgs;
  } else {
    args = player.targetArgs;
  }

  args = args.slice(0);
  for (var i = 0; i < args.length; i++) {
    args[i] = args[i].replace('%TYPE%', type);
    args[i] = args[i].replace('%TARGET%', streamInfos.target);
  }

  delete this._noPercent;

  this.emit("playing");

  var playerExe = player.name;
  if (this.playerPath) {
    playerExe = Path.join(this.playerPath, playerExe);
  }

  debug("Spawn ", playerExe, args);

  var playerProcess = child_p.spawn(playerExe, args, {
    stdio : [ 'pipe', 'pipe', 'pipe' ]
  });

  if (!playerProcess) {
    var error = new Error("Can not spawn player '" + self.playerName + "'");

    this.emit("error");
    return callback(error);
  }

  this.playerProcess = playerProcess;

  var self = this;
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

      debug("Emit progress", progress);
      self.emit("progress", progress);
    });
  }

  playerProcess.stdout.on('data', scanProgress);
  playerProcess.stderr.on('data', scanProgress);

  playerProcess.on("exit", function() {
    debug("Emit: sound:stopped");
    self.emit("stopped");
    delete self.playerProcess;
    callback();
  });
  playerProcess.on("error", function(error) {
    debug("Emit: sound:error", error);
    self.emit("error", error);
    delete self.playerProcess;

    callback(error);
  });

  if (streamInfos.stream) {
    playerProcess.stdin.pipe(streamInfos.stream);
  }
}

Sound.prototype._processProgress = function(d) {

  function normalizeNumber(f) {
    return Math.floor(f * 10) / 10;
  }

  var playRegExp = /^In:([0-9\.]+)% ([0-9]{2}):([0-9]{2}):([0-9\.]{5,6}) \[([0-9]{2}):([0-9]{2}):([0-9\.]{5,6})\] Out:([0-9\.kM]+)/
      .exec(d);
  if (playRegExp) {
    var percent = parseFloat(playRegExp[1]);
    var offset = parseInt(playRegExp[2], 10);
    offset = offset * 60 + parseInt(playRegExp[3], 10);
    offset = offset * 60 + parseFloat(playRegExp[4]);

    var left = parseInt(playRegExp[5], 10);
    left = left * 60 + parseInt(playRegExp[6], 10);
    left = left * 60 + parseFloat(playRegExp[7]);

    var outPart = playRegExp[6];
    var out = parseFloat(outPart);
    if (/k$/i.exec(outPart)) {
      out *= 1024;
    } else if (/m$/i.exec(outPart)) {
      out *= 1024 * 1024;
    }

    if (!offset && !left && !percent) {
      return;
    }

    if (this._noPercent === undefined && offset > 0 && !left && !percent) {
      this._noPercent = true;
    }

    if (this._noPercent === true) {
      return {
        offset : offset
      }
    }

    return {
      percent : normalizeNumber(percent),
      offset : normalizeNumber(offset),
      left : normalizeNumber(left),
      total : normalizeNumber(offset + left)
    };
  }

  var mpg123RegExp = /^Frame#\s+([0-9]+)\s*\[\s+([0-9]+)\],\s*Time:\s*([0-9]{2}):([0-9\.]{5,6})\s+\[([0-9]{2}):([0-9\.]{5,6})\]/i
      .exec(d);
  if (mpg123RegExp) {
    var offset = parseInt(mpg123RegExp[3], 10);
    offset = offset * 60 + parseFloat(mpg123RegExp[4]);

    var left = parseInt(mpg123RegExp[5], 10);
    left = left * 60 + parseFloat(mpg123RegExp[6]);

    var percent = offset / (offset + left) * 100;

    return {
      percent : normalizeNumber(percent),
      offset : normalizeNumber(offset),
      left : normalizeNumber(left),
      total : normalizeNumber(offset + left)
    };
  }
  return null;
}
