/*jslint node: true, esversion: 6 */
"use strict";

const UUID = require('uuid');
const events = require('events');

const Url = require('url');
const http = require('http');
const https = require('https');
const Path = require('path');
const fs = require('fs');
const child_p = require('child_process');
const EventEmitter = require('events');
const util = require('util');
const mime = require('mime');
const debug = require('debug')('soundplayer:sound');

const playerPath = process.env.PLAYER_PATH || "";

class Sound extends EventEmitter {
	/**
	 *
	 * @param {Player} soundPlayer
	 * @param {string} url
	 * @param {string} [uuid]
	 */
	constructor(soundPlayer, url, uuid) {
		super();

		this.soundPlayer = soundPlayer;
		this.url = url;
		this.uuid = uuid || UUID.v4();
	}

	/**
	 *
	 * @param {Function} [callback]
	 */
	play(callback) {
		callback = callback || ((error)=> {
				if (error) {
					console.error(error);
				}
			});

		this.soundPlayer.findPlayer((error, player) => {
			if (error) {
				return callback(error);
			}

			this._getStream(player, (error, streamInfos) => {
				if (error) {
					return callback(error);
				}

				this._exec(streamInfos, player, (error) => {
					if (error) {
						return callback(error);
					}

					callback();
				});
			});
		});
	}

	/**
	 *
	 * @param {Function} [callback]
	 */
	stop(callback) {
		callback = callback || ((error) => {
				if (error) {
					console.error(error);
				}
			});

		var playerProcess = this.playerProcess;
		if (!playerProcess) {
			return callback("No player");
		}

		playerProcess.kill();

		callback();
	}

	_getStream(player, callback) {
		var url = this.url;
		debug("_getStream", "Get stream url=", url, " player=", player);

		if (/^http:/.exec(url)) {
			if (player.httpSupported) {
				return callback(null, {
					target: url
				});
			}
			var httpOptions = Url.parse(url);
			var request = http.get(httpOptions, (response) => {
				debug("_getStream", "Read http stream", url, response, request);

				if (!response) {
					return callback("Can not get response");
				}

				var contentType = response.headers['content-type'];

				callback(null, {
					stream: response,
					contentType: contentType
				});
			});

			request.on("error", (e) => {
				callback(e);
			});
			return;
		}

		if (/^https:/.exec(url)) {
			if (player.httpsSupported) {
				return callback(null, {
					target: url
				});
			}

			var httpOptions = Url.parse(url);

			var request = https.get(httpOptions, (response) => {
				debug("_getStream", "Read https stream", url, response, request);

				if (!response) {
					return callback("Can not get response");
				}

				var contentType = response.headers['content-type'];

				callback(null, {
					stream: response,
					contentType: contentType
				});
			});

			request.on("error", (e) => {
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
					target: p
				});
			}

			var stream = fs.createReadStream(p, {
				flags: 'r',
				autoClose: true
			});

			debug("_getStream", "Read file: stream", url, p); // , stream);

			callback(null, {
				stream: stream,
				contentType: mimeType
			});
			return;
		}

		if (player.fileSupported !== false) {
			return callback(null, {
				target: url
			});
		}

		var stream = fs.createReadStream(url, {
			flags: 'r',
			autoClose: true
		});

		callback(null, {
			stream: stream,
			contentType: mimeType
		});
	}

	_exec(streamInfos, player, callback) {
		debug("_exec", "Playing ", streamInfos, player);

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

		debug("_exec", "Spawn ", playerExe, args);

		var playerProcess = child_p.spawn(playerExe, args, {
			stdio: ['pipe', 'pipe', 'pipe']
		});

		if (!playerProcess) {
			var error = new Error("Can not spawn player '" + this.playerName + "'");
			error.sound = this;

			this.emit("error");
			return callback(error);
		}

		this.playerProcess = playerProcess;

		var scanProgress = (data) => {
			var ds = String(data).split('\r');
			ds.forEach((d) => {
				d = d.replace(/\s+/g, ' ');
				// console.log('stdout: ' + d);
				var progress = this._processProgress(d);
				if (!progress) {
					return;
				}

				this.progress = progress;

				debug("_exec", "scanProgress", progress);
				this.emit("progress", progress);
			});
		}

		playerProcess.stdout.on('data', scanProgress);
		playerProcess.stderr.on('data', scanProgress);

		playerProcess.on("exit", () => {
			debug("_exec", "playerProcess onExit sound:stopped");
			this.emit("stopped");
			delete this.playerProcess;
			callback();
		});
		playerProcess.on("error", (error) => {
			debug("_exec", "playerProcess onError", error);
			this.emit("error", error);
			delete this.playerProcess;

			callback(error);
		});

		if (streamInfos.stream) {
			playerProcess.stdin.pipe(streamInfos.stream);
		}
	}

	_processProgress(d) {
		var now = Date.now();

		if (this._lastProgressDate &&
			this._lastProgressDate + this.soundPlayer.minimumDelayBetweenProgress > now) {
			return;
		}
		this._lastProgressDate = now;

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
					offset: offset
				}
			}

			return {
				percent: normalizeNumber(percent),
				offset: normalizeNumber(offset),
				left: normalizeNumber(left),
				total: normalizeNumber(offset + left)
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
				percent: normalizeNumber(percent),
				offset: normalizeNumber(offset),
				left: normalizeNumber(left),
				total: normalizeNumber(offset + left)
			};
		}

		var mplayerRegExp = /\w:\s+([0-9\.]+)\s*\([^\)]+\)\s*of\s*([0-9\.]+)\s*\([^\)]+\)\s*([0-9\.]+)%/i
			.exec(d);
		if (mplayerRegExp) {
			var offset = parseFloat(mplayerRegExp[1], 10);
			var total = parseFloat(mplayerRegExp[2], 10);
			var percent = parseFloat(mplayerRegExp[3], 10);

			return {
				percent: normalizeNumber(percent),
				offset: normalizeNumber(offset),
				total: normalizeNumber(total)
			};
		}

		return null;
	}
}

module.exports = Sound;
