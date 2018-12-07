'use strict';

const Alexa = require('alexa-sdk');
const parseString = require('xml2js').parseString;
const https = require('https');
const util = require('util');

let radioStreamInfo = {
  title: 'Radio Südostschweiz Livestream',
  subtitle: 'Alexa audio streaming skill for Radio Südostschweiz.',
  cardContent: "Radio Südostschweiz Alexa Skill",
  url: 'https://swisstxt2-lh.akamaihd.net/i/grischa_1@144003/master.m3u8',
  image: {
    largeImageUrl: 'https://www.suedostschweiz.ch/modules/custom/so_radio/images/microphon_off.png',
    smallImageUrl: 'https://www.suedostschweiz.ch/modules/custom/so_radio/images/microphon_off.png'
  }
};

let podcasts = {
  "0": {
    "title": "Podcasts von Radio Südostschweiz.",
    "subtitle": "Alexa podcast streaming skill for Radio Südostschweiz",
    "name": "R S O im Gespräch",
    "machine_name": "rso_im_gespraech",
    "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/1897039",
    "id": "0"
  },
  "1": {
    "title": "Podcasts von Radio Südostschweiz.",
    "subtitle": "Alexa podcast streaming skill for Radio Südostschweiz",
    "name": "100 Sekunden",
    "machine_name": "100_sekunden",
    "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/1897039",
    "id": "1"
  }
};

let currently_playing = {
  "podcast_episode": 0,
  "intent": "PlayPodcastIntent",
  "slot_id": ""
};

function getPodcastEpisodes(index, callback) {
  let podcast_episode_url;

  https.get(podcasts[index].podcastURL, (resp) => {
    let data = '';

    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      parseString(data, function (err, result) {
        if (!err) {
          let podcast_episode_urls = [];
          for (let i = 0; i < result.rss.channel[0]["item"].length; i++ ) {
            podcast_episode_url = result.rss.channel[0]["item"][i]["enclosure"][0]["$"]["url"];
            podcast_episode_urls.push(podcast_episode_url);
          }
          callback(null, podcast_episode_urls);
        } else {
          callback(err, null);
        }
      });
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
}

function buildPodcastListSpeech() {
  let count = Object.keys(podcasts).length;
  let speechoutput = 'Hier die Liste der Podcasts: ';

  for (let i = 0; i < count; i++) {
    speechoutput += podcasts[""+ i +""].name + ', ';
  }

  return speechoutput;
}

exports.handler = (event, context, callback) => {
  var alexa = Alexa.handler(event, context, callback);

  alexa.registerHandlers(
    handlers,
    audioEventHandlers
  );

  alexa.execute();
};

let handlers = {
  'LaunchRequest': function() {
    this.emit(':ask', 'Willkommen bei Radio Südostschweiz. Mit Alexa starte Radio gelangst du zum Livestream. ' +
        'Um die Podcasts zu hören, sag: "Alexa liste mir alle Podcasts auf". ' +
        'Was möchtest du tun?',
        'Mit Alexa starte Radio gelangst du zum Live Radio.');
  },
  'PlayRadioIntent': function() {
    this.response.speak('Viel Spass mit dem Radio von Radio Südostschweiz.').audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PlayPodcastIntent':function() {
    let that = this;
    getPodcastEpisodes("0", function (err, podcast_episode_urls) {
      if (err === null ) {
        let podcast = podcasts[0];
        let podcast_episode = podcast_episode_urls[currently_playing.podcast_episode];

        that.response.speak('Hier der standard Podcast ' + podcast.name + ' Episode' + currently_playing.podcast_episode).audioPlayerPlay('REPLACE_ALL', podcast_episode, podcast.machine_name+'_'+podcast.id, null, 0);
        console.log("Current PlayPodcastIntent: " + currently_playing.podcast_episode);
        that.emit(':responseReady');
      } else {
        that.response.speak('Es ist ein Fehler mit dem aufrufen des Podcasts aufgetreten.');
        that.emit(':responseReady');
        console.log("Error: " + err);
      }
    });

  },
  'PlayPodcastWithNameIntent': function(){
    let that = this;
    if (currently_playing.slot_id === "") {
      let slot_resolutions = this.event.request.intent.slots.podcast_name.resolutions;
      if (slot_resolutions !== undefined) {
        let slot_value_id = slot_resolutions.resolutionsPerAuthority[0].values[0].value.id;
        if (slot_value_id !== undefined) {
          getPodcastEpisodes(slot_value_id, function (err, podcast_episode_urls) {
            if (err == null) {
              let podcast = podcasts[slot_value_id];
              let podcast_episode = podcast_episode_urls[currently_playing.podcast_episode];
              currently_playing.intent = that.event.request.intent.name;
              currently_playing.slot_id = slot_value_id;
              that.response.speak('Hier der Podcast ' + podcast.name + ' Episode' + currently_playing.podcast_episode).audioPlayerPlay('REPLACE_ALL', podcast_episode, podcast.machine_name+'_'+podcast.id, null, 0);
              console.log("Current: " + util.inspect(currently_playing, {showHidden: false, depth: null}));
              that.emit(':responseReady');
            } else {
              that.response.speak('Es ist ein Fehler mit dem aufrufen des Podcasts aufgetreten.');
              that.emit(':responseReady');
              console.log("Error: " + err);
            }
          });
        }else{
          this.response.speak("Ich konnte aus dem Podcast keine ID lesen, deshalb habe ich ihn nicht gefunden.");
          this.emit(":responseReady");
        }
      }else{
        this.response.speak("Es tut mir leid, ich habe dich anscheinend nicht ganz verstanden. Beim nächsten Versuch klappt es.");
        this.emit(":responseReady");
      }
    }else{
      let slot_value_id = currently_playing.slot_id;
      getPodcastEpisodes(slot_value_id, function (err, podcast_episode_urls) {
        if (err == null) {
          let podcast = podcasts[slot_value_id];
          let podcast_episode = podcast_episode_urls[currently_playing.podcast_episode];
          currently_playing.intent = that.event.request.intent.name;
          currently_playing.slot_id = slot_value_id;
          that.response.speak('Hier der Podcast ' + podcast.name + ' Episode' + currently_playing.podcast_episode).audioPlayerPlay('REPLACE_ALL', podcast_episode, podcast.machine_name+'_'+podcast.id, null, 0);
          console.log("Current: " + util.inspect(currently_playing, {showHidden: false, depth: null}));
          that.emit(':responseReady');
        } else {
          that.response.speak('Es ist ein Fehler mit dem aufrufen des Podcasts aufgetreten.');
          that.emit(':responseReady');
          console.log("Error: " + err);
        }
      });
    }
  },
  'ListAllPodcastsIntent': function(){
    this.emit(':tell', buildPodcastListSpeech());
  },
  'AMAZON.HelpIntent': function() {
    // skill help logic goes here
    this.emit(':responseReady');
  },
  'SessionEndedRequest': function() {
    console.log("\n---------- ERROR ----------");
    console.log("\n" + JSON.stringify(this.event.request, null, 2));
  },
  'ExceptionEncountered': function() {
    console.log("\n---------- ERROR ----------");
    console.log("\n" + JSON.stringify(this.event.request, null, 2));
    this.callback(null, null)
  },
  'Unhandled': function() {
    this.response.speak('Entschuldigung, etwas ist schief gelaufen.');
    this.emit(':responseReady');
  },
  'AMAZON.NextIntent': function() {
    console.log(util.inspect(currently_playing, {showHidden: false, depth: null}));
    console.log("Current NextIntent before: " + currently_playing.podcast_episode);
    if (currently_playing.podcast_episode === 0) {
      this.response.speak("Dies ist die aktuellste Podcast Episode.");
      this.emit(':responseReady');
    }else{
      if (currently_playing.intent === 'PlayPodcastIntent') {
        currently_playing.podcast_episode = currently_playing.podcast_episode-1;
        this.emit('PlayPodcastIntent');
      } else {
        currently_playing.podcast_episode = currently_playing.podcast_episode-1;
        this.emit('PlayPodcastWithNameIntent');
      }
    }
  },
  'AMAZON.PreviousIntent': function() {
    console.log(util.inspect(currently_playing, {showHidden: false, depth: null}));
    console.log("Current NextIntent before: " + currently_playing.podcast_episode);

    if (currently_playing.intent === 'PlayPodcastIntent') {
      currently_playing.podcast_episode = currently_playing.podcast_episode+1;
      this.emit('PlayPodcastIntent');
    } else {
      currently_playing.podcast_episode = currently_playing.podcast_episode+1;
      this.emit('PlayPodcastWithNameIntent');
    }
  },
  'AMAZON.PauseIntent': function() {
    this.response.speak('Alles klar. Ich stoppe den Audio Player').audioPlayerStop();
    this.emit(':responseReady');
  },
  'AMAZON.CancelIntent': function() {
    this.emit('AMAZON.StopIntent');
  },
  'AMAZON.StopIntent': function() {
    this.response.speak('Okay. Ich habe alles gestoppt');
    this.emit(':responseReady');
  },
  'AMAZON.ResumeIntent': function() {
    this.response.speak("Woher bekomme ich diese Daten");
    this.emit(':responseReady');
  },
  'AMAZON.LoopOnIntent': function() {
    this.emit('AMAZON.StartOverIntent');
  },
  'AMAZON.LoopOffIntent': function() {
    this.emit('AMAZON.StartOverIntent');
  },
  'AMAZON.ShuffleOnIntent': function() {
    this.emit('AMAZON.StartOverIntent');
  },
  'AMAZON.ShuffleOffIntent': function() {
    this.emit('AMAZON.StartOverIntent');
  },
  'AMAZON.StartOverIntent': function() {
    this.response.speak('Sorry. Das kann ich momentan nicht machen.');
    this.emit(':responseReady');
  },
  'PlayCommandIssued': function() {

    if (this.event.request.type === 'IntentRequest' || this.event.request.type === 'LaunchRequest') {
      var cardTitle = radioStreamInfo.subtitle;
      var cardContent = radioStreamInfo.cardContent;
      var cardImage = radioStreamInfo.image;
      this.response.cardRenderer(cardTitle, cardContent, cardImage);
    }

    this.response.speak('Ich starte nun den Radio. Viel Spass.').audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PauseCommandIssued': function() {
    this.emit('AMAZON.StopIntent');
  }
};

var audioEventHandlers = {
  'PlaybackStarted': function() {
    this.emit(':responseReady');
  },
  'PlaybackFinished': function() {
    this.emit(':responseReady');
  },
  'PlaybackStopped': function() {
    this.emit(':responseReady');
  },
  'PlaybackNearlyFinished': function() {
    this.response.audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PlaybackFailed': function() {
    this.response.audioPlayerClearQueue('CLEAR_ENQUEUED');
    this.emit(':responseReady');
  }
};
