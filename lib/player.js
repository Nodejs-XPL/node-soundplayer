/*jslint node: true, esversion: 6 */
"use strict";

const async = require('async');
const child_p = require('child_process');
const EventEmitter = require('events');
const util = require('util');
const debug = require('debug')('soundplayer:player');

const Sound = require('./sound');

const playerList = [{
	name: 'afplay',
	testArgs: "--version"
}, {
	name: 'play',
	testArgs: "--version",
	streamArgs: ['-t', '%TYPE%', '-'],
	targetArgs: ['%TARGET%'],
	httpSupported: true
}, {
	name: 'mpg123',
	testArgs: "--version",
	streamArgs: ['-v', '-'],
	targetArgs: ['-v', '%TARGET%'],
	httpSupported: true
}, {
	name: 'mpg321',
	testArgs: "--version",
	streamArgs: ['-v', '-'],
	targetArgs: ['-v', '%TARGET%'],
	httpSupported: true
}, {
	name: 'mplayer',
	testArgs: "-v",
	streamArgs: ['-'],
	targetArgs: ['%TARGET%'],
	httpSupported: true
}];

// play is this
class _Player extends EventEmitter {
	constructor(configuration) {
		super();

		configuration = configuration || {};

		this.minimumDelayBetweenProgress = 1000 * (configuration.minimumDelayBetweenProgress || 10);

		this.playerPath = configuration.playerPath || process.env.PLAYER_PATH || "";

		this.configuration = configuration;
		this.player = null;

		debug("constructor", "playerPath=", this.playerPath, "configuration=", configuration);
	}

	/**
	 *
	 * @param {Function} callback
	 */
	findPlayer(callback) {
		if (this.player) {
			debug("findPlayer", "Player already known: " + this.player.name);
			return callback(null, this.player);
		}
		// a hack to check if we have any players available

		var userPlayerName = this.configuration.playerName || process.env.PLAYER_NAME;

		async.eachSeries(playerList, (player, callback) => {
			if (this.player) {
				debug("findPlayer", "Ignore player", player);
				return callback();
			}
			if (userPlayerName && userPlayerName !== player.name) {
				debug("findPlayer", "Ignore player", player + " not the specified one !");
				return callback();
			}
			debug("findPlayer", "Try player", player.name);

			var playerExe = player.name;
			if (this.playerPath) {
				playerExe = Path.join(this.playerPath, playerExe);
			}

			if (player.testArgs) {
				playerExe += " " + player.testArgs;
			}

			child_p.exec(playerExe, (error, stdout, stderr) => {
				if (stderr || error) {
					debug("findPlayer", "Return of ", player.name, "error=", error, "stdout=", stdout,
						"stderr=", stderr);
				}

				if (error === null || error.code !== 127) {
					debug("findPlayer", "Select player", player.name);
					// if the command was successful
					this.player = player;
					return callback();
				}

				// Problem !?
				callback();
			});

		}, (error) => {
			if (!error && !this.player) {
				error = new Error("Can not find a player");
			}
			if (error) {
				return callback(error);
			}

			this.emit('checked', this.player);

			callback(null, this.player);
		});
	}

//
// Allows the user to manually set a player name
//
	/**
	 *
	 * @param {String} name
	 * @returns {boolean}
	 */
	usePlayer(name) {
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
	 * @param {string} url
	 * @param {string] [uuid]
	 * @returns {Sound}
	 */
	newSound(url, uuid) {

		var sound = new Sound(this, url, uuid);

		return sound;
	}

	/**
	 * Have the user player the file, with a callback when it ends
	 *
	 * @param {string} url
	 * @param {string] [uuid]
	 * @param {Function} [callback]
	 * @returns {Sound}
	 */
	playSound(url, uuid, callback) {

		if (typeof (uuid) === "function") {
			callback = uuid;
			uuid = undefined;
		}

		var sound = this.newSound(url, uuid);

		setImmediate(() => {
			sound.play(callback || ((error) => {
					if (error) {
						console.error(error);
					}
				}));
		});

		this.emit("playSound", sound);

		return sound;
	}

	/**
	 * Have the user player the file, with a callback when it ends
	 *
	 * @param {string} url
	 * @param {Function} [callback]
	 * @returns {Sound}
	 */
	sound(url, callback) {
		return this.playSound(url, null, callback);
	}
}

module.exports = _Player;