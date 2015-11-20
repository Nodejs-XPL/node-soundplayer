## play.js - play sound files from node.js to your speakers 

### Installing play.js

     npm install soundplayer

# USAGE

      var SoundPlayer = require('soundplayer')
      
      var player=new SoundPlayer();

      // play with a callback
      player.sound('./wavs/sfx/intro.wav', function(){
  
        // these are all "fire and forget", no callback
        player.sound('./wavs/sfx/alarm.wav');
        player.sound('./wavs/sfx/crinkle.wav');
        player.sound('./wavs/sfx/flush.wav');
        player.sound('./wavs/sfx/ding.wav');
        
      });

      //If you want to know when the player has defintely started playing
      player.on('play', function (valid) {
        console.log('I just started playing!');
      });
      var sound=player.sound('./wavs/sfx/ding.wav');

      //If you want to know if this can't play for some reason
      sound.on('error', function (error) {
        console.error('I can't play!', error);
      });

## CLI DEMO

     cd examples
     node demo.js

### Requirements

Node.js

**One of the CLI based audio player**
 - 'mpg123'
 - 'mpg321'
 - 'play'
 - (anyother cli based audio player)

  If you know that a certain player will exist in the CLI
  you can actually force it to use that specific player using
  the usePlayer function (see below for specifics)

